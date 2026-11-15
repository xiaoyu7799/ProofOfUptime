import json
import unittest

# 单元测试模拟 GenLayer 基础环境与状态转换逻辑
class MockTreeMap(dict):
    pass

class MockGenVMUserError(Exception):
    pass

class TestProofOfUptimeLogic(unittest.TestCase):
    def setUp(self):
        self.targets = MockTreeMap()
        self.target_count = 0

    def register_target(self, name: str, url: str, sender: str) -> int:
        name = name.strip()
        url = url.strip()
        if len(name) < 2 or len(name) > 30:
            raise MockGenVMUserError("Name must be between 2 and 30 characters")
        if not url.startswith("https://"):
            raise MockGenVMUserError("URL must start with https://")
        if len(url) > 120:
            raise MockGenVMUserError("URL too long")
        
        target_id = self.target_count
        self.target_count = target_id + 1
        
        target_data = {
            "id": target_id,
            "name": name,
            "url": url,
            "creator": sender,
            "probed_count": 0,
            "last_status": "registered",
            "last_result": None
        }
        self.targets[target_id] = json.dumps(target_data)
        return target_id

    def test_normal_registration(self):
        tid = self.register_target("Cloudflare DNS", "https://1.1.1.1", "0x6F893325Bf28E3Eaa97d35Ced1780B8C4623C121")
        self.assertEqual(tid, 0)
        self.assertEqual(self.target_count, 1)
        data = json.loads(self.targets[0])
        self.assertEqual(data["name"], "Cloudflare DNS")
        self.assertEqual(data["last_status"], "registered")

    def test_short_name_rejected(self):
        with self.assertRaises(MockGenVMUserError):
            self.register_target("A", "https://1.1.1.1", "0x6F89")

    def test_non_https_rejected(self):
        with self.assertRaises(MockGenVMUserError):
            self.register_target("Insecure API", "http://insecure.api.com", "0x6F89")

    def test_url_too_long_rejected(self):
        long_url = "https://example.com/" + "a" * 120
        with self.assertRaises(MockGenVMUserError):
            self.register_target("Long URL", long_url, "0x6F89")

if __name__ == '__main__':
    unittest.main()
