# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
import json
from genlayer import *


class ProofOfUptime(gl.Contract):
    targets: TreeMap[u256, str]
    target_count: u256

    def __init__(self):
        self.target_count = 0

    @gl.public.write
    def register_target(self, name: str, url: str) -> u256:
        name = name.strip()
        url = url.strip()
        if len(name) < 2 or len(name) > 30:
            raise gl.vm.UserError("Name must be between 2 and 30 characters")
        if not url.startswith("https://"):
            raise gl.vm.UserError("URL must start with https://")
        if len(url) > 120:
            raise gl.vm.UserError("URL too long")
        
        target_id = self.target_count
        self.target_count = target_id + 1
        
        target_data = {
            "id": target_id,
            "name": name,
            "url": url,
            "creator": str(gl.message.sender_address),
            "probed_count": 0,
            "last_status": "registered",
            "last_result": None
        }
        self.targets[target_id] = json.dumps(target_data)
        return target_id

    @gl.public.write
    def probe_target(self, target_id: u256) -> str:
        if target_id not in self.targets:
            raise gl.vm.UserError("Target not found")
        
        target = json.loads(self.targets[target_id])
        target_url = target["url"]

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

        result = gl.vm.run_nondet_unsafe(fetch, validate)
        
        target["probed_count"] = target.get("probed_count", 0) + 1
        target["last_status"] = "active"
        target["last_result"] = result
        self.targets[target_id] = json.dumps(target)
        return json.dumps(result)

    @gl.public.view
    def get_target_count(self) -> u256:
        return self.target_count

    @gl.public.view
    def get_target(self, target_id: u256) -> str:
        if target_id not in self.targets:
            raise gl.vm.UserError("Target not found")
        return self.targets[target_id]

    @gl.public.view
    def list_targets(self, offset: u256, limit: u256) -> str:
        if limit < 1 or limit > 20:
            raise gl.vm.UserError("Limit must be between 1 and 20")
        out = []
        end = offset + limit
        if end > self.target_count:
            end = self.target_count
        i = offset
        while i < end:
            out.append(json.loads(self.targets[i]))
            i = i + 1
        return json.dumps(out)
