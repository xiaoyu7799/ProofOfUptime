import ast
import json
import unittest
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "contracts" / "ProofOfUptime.py"

EXPECTED_TX = {
    "deploy": "0x95062b39e8cae8be5307927b445728c34529353c264e57c167283bd63a4c8bcb",
    "registerTarget0": "0xd541429e2aebce353ff8fb82daf677675d82d5ce17468e8816df2dd3296ec976",
    "probeTarget0Failure": "0xc53d6b6eb5e8d1e37a2707ec5f3e2615c49b000634ff6b195f5f25f78b5b6fa8",
    "registerTarget1": "0xf40b36b0d857f03039207a5c0f124d00e7c1ebf916a4dd00f036d7f1430c4ae7",
    "probeTarget1Success": "0x03c5b525e12f81cf36f64edc30095af6fd0bfe3b921097b34e3b2a70e4865960",
}
CONTRACT_ADDRESS = "0x613Ccb8a943179c0d56c2A194F69261f7108F82A"


def load_json(relative_path):
    return json.loads((ROOT / relative_path).read_text(encoding="utf-8"))


def dotted_name(node):
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        prefix = dotted_name(node.value)
        return f"{prefix}.{node.attr}" if prefix else node.attr
    return ""


class TestContractSource(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = CONTRACT_PATH.read_text(encoding="utf-8")
        cls.tree = ast.parse(cls.source, filename=str(CONTRACT_PATH))
        cls.contract = next(
            node for node in cls.tree.body
            if isinstance(node, ast.ClassDef) and node.name == "ProofOfUptime"
        )
        cls.methods = {
            node.name: node for node in cls.contract.body
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        }

    def test_contract_storage_and_public_methods(self):
        self.assertIn("gl.Contract", [dotted_name(base) for base in self.contract.bases])
        annotated = [node.target.id for node in self.contract.body if isinstance(node, ast.AnnAssign)]
        self.assertIn("targets", annotated)
        self.assertIn("target_count", annotated)
        expected = {
            "register_target": "gl.public.write",
            "probe_target": "gl.public.write",
            "get_target_count": "gl.public.view",
            "get_target": "gl.public.view",
            "list_targets": "gl.public.view",
        }
        for method_name, decorator_name in expected.items():
            self.assertIn(method_name, self.methods)
            decorators = [dotted_name(item) for item in self.methods[method_name].decorator_list]
            self.assertIn(decorator_name, decorators)

    def test_registration_guards_are_in_contract_source(self):
        source = ast.get_source_segment(self.source, self.methods["register_target"])
        for fragment in (
            "len(name) < 2",
            "len(name) > 30",
            'url.startswith("https://")',
            "len(url) > 120",
        ):
            self.assertIn(fragment, source)

    def test_probe_uses_nondeterministic_consensus_and_commits_after_result(self):
        source = ast.get_source_segment(self.source, self.methods["probe_target"])
        self.assertIn("gl.nondet.web.get(target_url)", source)
        self.assertIn("gl.vm.run_nondet_unsafe(fetch, validate)", source)
        self.assertLess(
            source.index("result = gl.vm.run_nondet_unsafe(fetch, validate)"),
            source.index('target["probed_count"]'),
        )

    def test_equivalence_check_compares_status_and_liveness_not_sample(self):
        probe = self.methods["probe_target"]
        nested = {
            node.name: node for node in ast.walk(probe)
            if isinstance(node, ast.FunctionDef)
        }
        validate_source = ast.get_source_segment(self.source, nested["validate"])
        self.assertIn('leader.get("status_code") == own.get("status_code")', validate_source)
        self.assertIn('leader.get("is_alive") == own.get("is_alive")', validate_source)
        self.assertNotIn('leader.get("sample")', validate_source)


class TestChainEvidence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.receipts = load_json("audit-package/transaction_receipts.json")
        cls.consensus = load_json("audit-package/consensus_votes.json")
        cls.readback = load_json("audit-package/readback_results.json")
        cls.fees = load_json("audit-package/fee_audit.json")
        cls.closure = load_json("evidence_closure.json")

    def test_five_historical_transactions_are_finalized(self):
        self.assertEqual(set(self.receipts), set(EXPECTED_TX))
        for key, expected_hash in EXPECTED_TX.items():
            item = self.receipts[key]
            self.assertEqual(item["hash"].lower(), expected_hash.lower())
            self.assertEqual(item["transaction"]["status"], 7)
            self.assertEqual(item["transaction"]["statusName"], "FINALIZED")
            self.assertEqual(item["receipt"]["transactionHash"].lower(), expected_hash.lower())

    def test_consensus_outcomes_match_receipts(self):
        failure = self.consensus["probeTarget0Failure"]
        success = self.consensus["probeTarget1Success"]
        self.assertEqual(failure["statusName"], "FINALIZED")
        self.assertEqual(failure["resultName"], "MAJORITY_DISAGREE")
        self.assertEqual(Counter(failure["consensusData"]["votes"].values()), Counter({"disagree": 3, "idle": 2}))
        self.assertEqual(success["statusName"], "FINALIZED")
        self.assertEqual(success["resultName"], "MAJORITY_AGREE")
        self.assertEqual(Counter(success["consensusData"]["votes"].values()), Counter({"agree": 3, "idle": 2}))

    def test_negative_probe_reason_is_genvm_tld_policy_not_http_301(self):
        failure = self.consensus["probeTarget0Failure"]
        serialized = json.dumps(failure, ensure_ascii=False)
        self.assertIn("TLD_FORBIDDEN", serialized)
        self.assertIn("'tld': '1'", serialized)
        self.assertIn("TLD_FORBIDDEN", self.closure["historicalFailureTx"]["reason"])
        self.assertNotIn("301 Redirect", self.closure["historicalFailureTx"]["reason"])

    def test_latest_final_readback_matches_expected_state(self):
        self.assertEqual(self.readback["contractAddress"], CONTRACT_ADDRESS)
        self.assertEqual(self.readback["transactionHashVariant"], "TransactionHashVariant.LATEST_FINAL")
        self.assertEqual(self.readback["totalTargetsCount"], 2)
        target0 = self.readback["target0"]["parsed"]
        target1 = self.readback["target1"]["parsed"]
        self.assertEqual(target0["last_status"], "registered")
        self.assertEqual(target0["probed_count"], 0)
        self.assertEqual(target1["last_status"], "active")
        self.assertEqual(target1["probed_count"], 1)
        self.assertEqual(target1["last_result"]["status_code"], 200)
        self.assertEqual(self.readback["listTargets"]["parsed"], [target0, target1])

    def test_fee_audit_matches_all_five_receipts(self):
        fee_items = self.fees["transactionFeesAnalysis"]
        self.assertEqual(len(fee_items), 5)
        by_key = {item["key"]: item for item in fee_items}
        for key, receipt in self.receipts.items():
            fee = by_key[key]
            self.assertEqual(fee["hash"].lower(), receipt["hash"].lower())
            self.assertEqual(str(fee["gasUsed"]), str(receipt["receipt"]["gasUsed"]))
            self.assertEqual(str(fee["effectiveGasPrice"]), "0")
            self.assertEqual(str(fee["actualFeePaidWei"]), "0")

    def test_evidence_closure_points_to_same_contract_and_transactions(self):
        self.assertEqual(self.closure["contractAddress"], CONTRACT_ADDRESS)
        self.assertEqual(self.closure["chain"]["id"], 61999)
        self.assertEqual(self.closure["historicalFailureTx"]["txHash"], EXPECTED_TX["probeTarget0Failure"])
        self.assertEqual(self.closure["successfulClosureTx"]["probeTxHash"], EXPECTED_TX["probeTarget1Success"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
