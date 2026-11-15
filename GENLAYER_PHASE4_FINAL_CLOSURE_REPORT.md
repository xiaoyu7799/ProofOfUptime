# GenLayer Phase 4 — ProofOfUptime 最终交付闭环验收报告 (含完整审计包与远程验收)

**报告文件**：`GENLAYER_PHASE4_FINAL_CLOSURE_REPORT.md`  
**项目仓库**：[ProofOfUptime](https://github.com/xiaoyu7799/ProofOfUptime)  
**审计证据包**：`audit-package/`  
**智能合约名称**：ProofOfUptime (去中心化公共服务可用性公证合约)  
**目标网络**：GenLayer Stable Studionet (Chain ID: `61999`, RPC: `https://studio.genlayer.com/api`)  
**合约部署地址**：`0x613Ccb8a943179c0d56c2A194F69261f7108F82A`  
**测试钱包地址**：`0x6F893325Bf28E3Eaa97d35Ced1780B8C4623C121`  
**综合审计判定**：**`PHASE 4 — FULLY DELIVERED & REMOTELY VERIFIED`**

---

## 一、三层交付状态明确界定

按照工程交付与验收规范，将本次 Phase 4 的交付完成状态区分为三个独立维度，全项通过：

| 交付维度 | 实际完成状态 | 详细状态说明与核验凭据 |
| :--- | :---: | :--- |
| **1. 链上验收状态** | **`COMPLETED` (已完成 / 全流程闭环)** | 合约部署、两次目标注册、负向探测（301 触发 `MAJORITY_DISAGREE` 回滚）、正向探测（200 达成 `MAJORITY_AGREE` 推进）及 `LATEST_FINAL` 链上读回验证全部闭环，**全部 5 笔真实链上交易状态均为 `FINALIZED` (状态码 7)**。 |
| **2. Git 本地归档状态** | **`COMPLETED` (已完成 / 仓库干净)** | 本地仓库提交历史完整连续，六份审计原始文件全部物理落盘于 `audit-package/` 并在本地完成结构化提交，开源说明 `README.md`、`LICENSE` 与工程配置 `package.json` 齐备，工作树保持绝对干净，敏感私钥隔离完好。 |
| **3. GitHub 远程推送状态** | **`COMPLETED` (已完成 / 远程核验通过)** | 正式公开仓库 `xiaoyu7799/ProofOfUptime` 已创建并完成推送，经由 GitHub REST API 校验，全部文件均可公开访问，远程 HEAD 完整 SHA 与本地完全一致。 |

---

## 二、审计归档六份文件清单与 SHA-256 完整性核验

所有链上底层回执、验证者共识投票记录、状态机读回快照、费用审计及 Git 安全扫描文件真实存在于 `audit-package/` 目录，经精确物理读取与哈希计算，完整性数据如下：

| 文件名称 | 相对路径 | 实际物理大小 (Bytes) | SHA-256 完整性哈希 | 核心审计用途与内容证明 |
| :--- | :--- | :---: | :--- | :--- |
| **`transaction_receipts.json`** | `audit-package/transaction_receipts.json` | 681,506 | `6ee2df5025aa2a9c96b89837eea7dac33b3f2b93392f67d8eed01c5603620f0b` | 记录全部 5 笔交易的原始 RPC 详细记录与回执字段（含 raw calldata、nonce、r/s/v 等） |
| **`consensus_votes.json`** | `audit-package/consensus_votes.json` | 86,162 | `4322b63304ac5c3888f7c54bbaa409c2a0faf267fa4910688085c7667c39dc01` | 记录两笔探测交易中全部验证者节点的独立投票分布、共识枚举代码、执行返回及 Quorum 裁决 |
| **`readback_results.json`** | `audit-package/readback_results.json` | 4,116 | `8ef334ac1b2802a0d3b839bd85845d9511608586d67075fbce50989bddf2a888` | 官方 SDK `TransactionHashVariant.LATEST_FINAL` 读回的 Target 0 与 Target 1 状态前后对照 |
| **`fee_audit.json`** | `audit-package/fee_audit.json` | 4,948 | `5f17d946bdb2156db3b514f950434cbdb42f23bb7c7f443b59232c0794b10732` | 明确区分 gasUsed 与 actualFeePaid 的费用审计，记录 Studionet 费用免除参数 |
| **`git_security_audit.md`** | `audit-package/git_security_audit.md` | 8,433 | `f8b4c5197649adedef5ef7e2eeda57a98b1d98af1bd3838db221aa8978162971` | 工作区与全量 Git 历史私钥扫描、SHA-256 指纹比对报告与规则审计 |
| **`git_history.txt`** | `audit-package/git_history.txt` | 1,030,567 | `9162d4c4efadb33f40e9126237e2778f6aad3e8db9961e7a03c86b7a844c1e8f` | 截止至 Commit `d08fc2e` 的完整提交历史代码差异补丁快照 |

> [!NOTE]
> **历史快照边界声明**：`audit-package/git_history.txt` 记录截止到 Commit `d08fc2e5bd5cb6ff57181526eae46d64b8f16c6f` 为止的完整补丁历史。由于历史文件自身作为工程资产纳入提交，后续封装该文件的提交不包含在历史文件自身内部，以避免循环自引用。

---

## 三、合约 validate() 的等价性边界与共识证明能力分析 (不夸大共识能力)

在 [ProofOfUptime.py](./contracts/ProofOfUptime.py) 中，非确定性抓取与等价性验证的核心实现如下：

```python
def fetch():
    res = gl.nondet.web.get(target_url)
    if res.status != 200:
        raise gl.vm.UserError("Target probe returned non-200 status")
    body_text = str(res.body)
    if len(body_text) == 0:
        raise gl.vm.UserError("Empty response body")
    return {
        "status_code": res.status,
        "is_alive": True,
        "sample": body_text[:64]
    }

def validate(leader_result) -> bool:
    if not isinstance(leader_result, gl.vm.Return):
        return False
    leader = leader_result.calldata
    if not isinstance(leader, dict):
        return False
    try:
        own = fetch()
    except gl.vm.UserError:
        return False
    return (
        leader.get("status_code") == own.get("status_code")
        and leader.get("is_alive") == own.get("is_alive")
    )
```

### 1. 字段级验证范围与等价性边界判定

| 字段名称 | 是否纳入 validate() 比较 | 验证范围与约束机制 | 共识证明能力客观声明 |
| :--- | :---: | :--- | :--- |
| **`status_code`** | **是 (强制比较)** | `leader.get("status_code") == own.get("status_code")`。<br>要求 Leader 与验证者独立发起的 HTTP 请求状态码必须严格一致（当前实现中非 200 均抛出异常导致验证失败）。 | **强共识证明**：证实目标服务在验证者群体独立访问视角下，HTTP 协议状态码具有确定性一致（例如稳定返回 200）。 |
| **`is_alive`** | **是 (强制比较)** | `leader.get("is_alive") == own.get("is_alive")`。<br>布尔值，要求 Leader 与验证者均成功收到非空正文（`len(body_text) > 0`）。 | **强共识证明**：证实服务在去中心化多节点探测下处于存活且能响应正文的状态。 |
| **`sample`** | **否 (未纳入比较)** | 在 `validate()` 返回值中明确**未**包含 `leader.get("sample") == own.get("sample")`。<br>`sample` 仅为 Leader 提案时截取的响应前 64 字节数据。 | **单点采样快照（非全体验证者等价共识）**：链上持久化记录的 `sample` 仅为 Leader 节点的单次抓取切片。**不可宣称为全体验证者对正文字节级逐一比对达成的共识**。 |

### 2. 设计取舍与客观结论
- **工程合理性**：不比对 `sample` 允许了目标服务正文中存在微小动态差异（如动态毫秒时间戳、请求追踪 ID 等），防止由于正文字符级微小不一致导致合法服务被判定为共识失败。
- **边界声明**：GenLayer 验证者群体达成的是**目标服务“在指定探测时刻可正常访问且返回 HTTP 200”的存活性与状态码共识**；并未对响应内容进行全量逐字节的不可变证明。

---

## 四、五笔真实链上交易与真实费用审计核验

必须严格区分 Gas 使用量（`gasUsed`）、有效单价（`effectiveGasPrice`）与实际手续费（`actualFeePaid`）。所有交易数据直接取自真实 RPC 回执，未做任何修改：

| # | 交易操作 | 完整交易哈希 (Tx Hash) | 最终状态 | 耗时 | 共识/执行结果 | Gas 使用量 | 有效 Gas 单价 | 实际手续费 |
| :-: | :--- | :--- | :-: | :-: | :---: | :-: | :-: | :-: |
| **1** | **合约部署** | `0x95062b39e8cae8be5307927b445728c34529353c264e57c167283bd63a4c8bcb` | `FINALIZED` (7) | 41.5s | SUCCESS (部署落链) | 8,000,000 | 0 WEI | 0 WEI |
| **2** | **注册 Target 0** | `0xd541429e2aebce353ff8fb82daf677675d82d5ce17468e8816df2dd3296ec976` | `FINALIZED` (7) | 39.6s | SUCCESS (注册完成) | 8,000,000 | 0 WEI | 0 WEI |
| **3** | **负向探测 Target 0** | `0xc53d6b6eb5e8d1e37a2707ec5f3e2615c49b000634ff6b195f5f25f78b5b6fa8` | `FINALIZED` (7) | 64.7s | **`MAJORITY_DISAGREE`** | 8,000,000 | 0 WEI | 0 WEI |
| **4** | **注册 Target 1** | `0xf40b36b0d857f03039207a5c0f124d00e7c1ebf916a4dd00f036d7f1430c4ae7` | `FINALIZED` (7) | 37.8s | SUCCESS (注册完成) | 8,000,000 | 0 WEI | 0 WEI |
| **5** | **正向探测 Target 1** | `0x03c5b525e12f81cf36f64edc30095af6fd0bfe3b921097b34e3b2a70e4865960` | `FINALIZED` (7) | 39.7s | **`MAJORITY_AGREE`** | 8,000,000 | 0 WEI | 0 WEI |

- **费用审计结论**：在 Stable Studionet 网络中，交易回执明确记录 `gasUsed = 8,000,000`，但由于底层协议实施 `effectiveGasPrice = 0x0`（0 WEI），计算公式为 `8,000,000 * 0 = 0 WEI`。Gas 消耗真实发生，但用户支付手续费为零。

---

## 五、两笔探测交易共识与链上状态读回对照

### 1. 验证者投票 Quorum 对照
- **Target 0 (`probe_target(0)`)**：
  - 目标地址：`https://1.1.1.1`（服务端返回 301 永久重定向）
  - 验证者投票：3 个活跃验证者全部投出 `disagree`，达成 `MAJORITY_DISAGREE`。
  - 链上状态：`last_status = "registered"`, `probed_count = 0`，未受污染。
- **Target 1 (`probe_target(1)`)**：
  - 目标地址：`https://api.drand.sh/public/1`（返回 200 OK，正文确定）
  - 验证者投票：3 个活跃验证者全部投出 `agree`，达成 `MAJORITY_AGREE`。
  - 链上状态：`last_status` 成功翻转为 `"active"`，`probed_count` 递增为 `1`。

### 2. SDK 读回交叉验证
使用官方 SDK `TransactionHashVariant.LATEST_FINAL` 调用 `get_target_count()` 读回值为 `2`；调用 `list_targets(0, 5)` 返回列表与逐个调用 `get_target(0)`、`get_target(1)` 的 JSON 结构 100% 严格一致。

---

## 六、Git 提交历史演进全景

以实际 Git 提交历史为准，自初始部署至远程对齐的关键里程碑如下：

```text
* d08fc2e (HEAD -> master, origin/master) chore(git): ignore local delivery summary file
* e6c9759 docs(closure): update final closure report with complete integrity and state mapping
* e82c199 docs(audit): update git history and security audit with latest commit
* 62985c1 docs(project): add README.md, package.json, and update closure report with SHA-256 integrity
* 3f68963 docs(closure): finalize Phase 4 delivery, equivalence boundaries, and status distinction
* 7519b79 docs(audit): finalize audit package with all 5 transaction receipts, consensus votes, and security report
* 3425c92 docs(phase4): add final closure report GENLAYER_PHASE4_FINAL_CLOSURE_REPORT.md
* 37baa20 feat(phase4): ProofOfUptime successful consensus closure and on-chain state verification
* cc4b6cf feat(phase4): ProofOfUptime Intelligent Contract implementation, Studionet deployment and evidence verification
```

---

## 七、Git 安全扫描结论与环境隔离保障

- **测试私钥安全**：测试私钥存放于受保护忽略目录 `.secrets/wallet.json`，全量历史 SHA-256 指纹比对 **0 命中、0 泄露**。若本地环境缺少该文件，则安全审计脚本如实标注比对未执行，不虚构结果。
- **个人钱包隔离**：测试过程未读取、导出或调用任何个人钱包（OKX / MetaMask）凭证。
- **合约状态保全**：未对链上已部署合约做任何修改，未发起任何无授权的额外交易。

**总结判定**：**`PHASE 4 — FULLY DELIVERED & REMOTELY VERIFIED`**
