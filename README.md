# ProofOfUptime — Decentralized Service Availability Oracle on GenLayer

ProofOfUptime 是基于 GenLayer 智能合约（Intelligent Contract）实现的去中心化公共服务可用性公证协议。通过 GenVM 的非确定性 Web 抓取能力（`gl.nondet.web.get`）与去中心化验证者等价性共识机制（Equivalence Principle），网络多节点独立发起对目标服务的 HTTP 存活性探测，杜绝单点监控造假，实现不可篡改的服务可用性链上公证。

---

## 核心特性

- **去中心化状态探测**：利用 GenVM 的 `gl.nondet.web.get` 接口，由多个验证者独立向目标 URL 发起实时 HTTP GET 探测。
- **等价性共识机制**：验证者独立执行 `fetch` 并通过 `validate` 校验 Leader 提案的状态码与存活性标志位是否一致。
- **自动状态回滚与保护**：当探测遇到非 200 响应、GenVM URL 策略拒绝或节点间结果不一致时，验证者可达成 `MAJORITY_DISAGREE`；未通过共识的探测不会覆盖已存储的目标状态。
- **费用模型明确界定**：真实记录链上 Gas 消耗（`gasUsed = 8,000,000`），基于 Studionet `effectiveGasPrice = 0 WEI`，实现零代币消耗部署与调用。
- **完备的链上读回验证**：支持基于 `LATEST_FINAL` 的单项与分页查询，状态机严格可复现。

---

## 部署与网络信息

- **部署网络**：GenLayer Stable Studionet
- **Chain ID**：`61999` (`0xf22f`)
- **RPC 节点**：`https://studio.genlayer.com/api`
- **合约部署地址**：`0x613Ccb8a943179c0d56c2A194F69261f7108F82A`
- **合约部署交易**：`0x95062b39e8cae8be5307927b445728c34529353c264e57c167283bd63a4c8bcb` (FINALIZED)
- **合约源代码**：`contracts/ProofOfUptime.py`
- **SDK 依赖**：`genlayer-js: ^1.1.8`
- **公开 GitHub 仓库**：https://github.com/xiaoyu7799/ProofOfUptime

---

## 合约架构与状态机设计

合约采用 Python 语言基于 `genlayer` 框架编写：

```python
class ProofOfUptime(gl.Contract):
    targets: TreeMap[u256, str]
    target_count: u256
```

### 状态字段设计

每个监控目标（Target）以 JSON 结构序列化存储于 `targets` 字典中：

```json
{
  "id": 1,
  "name": "Drand Genesis Round",
  "url": "https://api.drand.sh/public/1",
  "creator": "0x6F893325Bf28E3Eaa97d35Ced1780B8C4623C121",
  "probed_count": 1,
  "last_status": "active",
  "last_result": {
    "status_code": 200,
    "is_alive": true,
    "sample": "b'{\"round\":1,\"randomness\":\"101297f1ca7dc44ef6088d94ad5fb7ba03455"
  }
}
```

### 核心方法

| 方法名 | 类型 | 参数 | 说明 |
| :--- | :--- | :--- | :--- |
| `register_target` | Public Write | `name: str, url: str` | 注册新的可用性监控目标，初始状态为 `registered` |
| `probe_target` | Public Write | `target_id: u256` | 触发非确定性探测，通过验证者共识更新状态 |
| `get_target_count`| Public View | 无 | 查询当前系统注册的目标总数 |
| `get_target` | Public View | `target_id: u256` | 查询指定目标的最新持久化数据 |
| `list_targets` | Public View | `offset: u256, limit: u256` | 分页遍历已注册的监控目标列表 |

---

## validate() 等价性边界与共识证明能力分析

在去中心化非确定性执行中，`validate` 函数定义了验证者接受 Leader 提案的等价性准则：

```python
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

### 验证范围与客观能力边界声明

1. **`status_code`（强共识）**：强制比较 Leader 与各 Validator 独立抓取的 HTTP 状态码（必须均返回 200）。证明了在多节点视角下该服务具备确定性的 HTTP 状态。
2. **`is_alive`（强共识）**：强制比较响应体非空标志。证明了多节点共同见证服务存活。
3. **`sample`（单点采样快照，未纳入比较）**：在 `validate()` 中**未对 `sample` 进行逐字节比对**。
   - **技术边界声明**：`sample`（响应前 64 字节）仅为 Leader 节点提案时的单次采样快照，随提案写入状态。
   - **设计考量**：不强制正文字节一致性避免了因微小动态内容（如时间戳、追踪 ID）导致的误判分歧。
   - **边界客观性**：本协议证明的是**目标服务在探测时刻的“可用性与状态码一致性”**，而非“正文内容逐字节不可变证明”。

---

## 真实链上交易与证据数据

本项目在 Stable Studionet 上完成了 5 笔真实的链上交互，全部达成不可逆的 `FINALIZED`（状态码 7）：

| # | 交易操作 | 完整交易哈希 (Tx Hash) | 状态 | 共识判定 | Gas 使用量 | 有效 Gas 单价 | 实际手续费 | 耗时 |
| :-: | :--- | :--- | :-: | :-: | :-: | :-: | :-: | :-: |
| **1** | **合约部署** | `0x95062b39e8cae8be5307927b445728c34529353c264e57c167283bd63a4c8bcb` | `FINALIZED` | SUCCESS | 8,000,000 | 0 WEI | 0 WEI | 41.5s |
| **2** | **注册 Target 0** | `0xd541429e2aebce353ff8fb82daf677675d82d5ce17468e8816df2dd3296ec976` | `FINALIZED` | SUCCESS | 8,000,000 | 0 WEI | 0 WEI | 39.6s |
| **3** | **负向探测 Target 0** | `0xc53d6b6eb5e8d1e37a2707ec5f3e2615c49b000634ff6b195f5f25f78b5b6fa8` | `FINALIZED` | `MAJORITY_DISAGREE` | 8,000,000 | 0 WEI | 0 WEI | 64.7s |
| **4** | **注册 Target 1** | `0xf40b36b0d857f03039207a5c0f124d00e7c1ebf916a4dd00f036d7f1430c4ae7` | `FINALIZED` | SUCCESS | 8,000,000 | 0 WEI | 0 WEI | 37.8s |
| **5** | **正向探测 Target 1** | `0x03c5b525e12f81cf36f64edc30095af6fd0bfe3b921097b34e3b2a70e4865960` | `FINALIZED` | `MAJORITY_AGREE` | 8,000,000 | 0 WEI | 0 WEI | 39.7s |

- **负向共识闭环**：Target 0（`https://1.1.1.1`）在 GenVM URL 策略检查阶段触发 `TLD_FORBIDDEN`（`tld = 1`），未取得 HTTP 响应；5 个验证者中 3 票 Disagree、2 票 Idle，最终为 `MAJORITY_DISAGREE`，链上状态保持 `registered`。
- **正向共识闭环**：Target 1（Drand Genesis `https://api.drand.sh/public/1`）稳定返回 200 OK，3 票 Agree 达成 Quorum，状态成功翻转为 `active`。

---

## 审计材料

原始链上材料保存在 `audit-package/`：

- `transaction_receipts.json`：五笔交易的底层回执。
- `consensus_votes.json`：负向与正向探测的验证者投票。
- `readback_results.json`：`LATEST_FINAL` 状态读回。
- `fee_audit.json`：Gas 使用量、有效单价与实际手续费。
- `git_security_audit.md`：安全扫描结果。
- `git_history.txt`：已清理本地绝对路径的公开历史快照。

六份审计文件的最新 SHA-256 与字节数以最终闭环报告中的完整性清单为准。

## 自动化回归验证

```bash
npm test
npm run scan:security
python -m py_compile contracts/ProofOfUptime.py
```

回归测试检查合约源码结构、等价性判断、五笔交易状态、验证者投票、费用记录和链上读回的一致性。安全扫描器根据实际扫描结果返回 PASS 或 FAIL，并验证敏感文件忽略规则。上述测试为离线检查，不等同于 GenVM 运行时测试或重新发起 RPC 验收。


## 已知技术限制

1. **URL 访问策略限制**：本轮 Target 0 的 `https://1.1.1.1` 在 GenVM URL 策略检查阶段触发 `TLD_FORBIDDEN`，没有取得 HTTP 响应；因此本次证据不证明服务器返回 301/302。合约对实际取得的非 200 响应会抛出异常，但本轮未测试重定向跟随行为。
2. **正文字节未达成共识**：等价性逻辑当前仅覆盖状态码与存活性，链上持久化的 `sample` 为 Leader 单点采样，不具备逐字节全体验证者共识。
3. **网络依赖**：仅适配 GenLayer Stable Studionet（Chain ID `61999`），不支持其他未配置非确定性 Web 模块的传统 EVM 网络。

---

## 许可证

本项目采用 MIT 许可证开源，详情参阅 [LICENSE](./LICENSE)。
