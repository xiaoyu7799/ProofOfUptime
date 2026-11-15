# ProofOfUptime — Decentralized Service Availability Oracle on GenLayer

ProofOfUptime 是基于 GenLayer 智能合约（Intelligent Contract）实现的去中心化公共服务可用性公证协议。通过 GenVM 的非确定性 Web 抓取能力（`gl.nondet.web.get`）与去中心化验证者等价性共识机制（Equivalence Principle），网络多节点独立发起对目标服务的 HTTP 存活性探测，杜绝单点监控造假，实现不可篡改的服务可用性链上公证。

---

## 核心特性

- **去中心化状态探测**：利用 GenVM 的 `gl.nondet.web.get` 接口，由多个验证者独立向目标 URL 发起实时 HTTP GET 探测。
- **等价性共识机制**：验证者独立执行 `fetch` 并通过 `validate` 校验 Leader 提案的状态码与存活性标志位是否一致。
- **自动状态回滚与保护**：当目标服务异常（如 HTTP 301 重定向、404 未找到、500 服务端故障）导致验证者分歧时，链上达成 `MAJORITY_DISAGREE`，业务状态自动回滚，历史数据不受污染。
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

- **负向共识闭环**：Target 0（Cloudflare DNS `https://1.1.1.1`）因服务端返回 301 永久重定向触发合约非 200 保护，3 票 Disagree 达成 Quorum，状态安全回滚。
- **正向共识闭环**：Target 1（Drand Genesis `https://api.drand.sh/public/1`）稳定返回 200 OK，3 票 Agree 达成 Quorum，状态成功翻转为 `active`。

---

## 审计材料清单与 SHA-256 完整性校验

所有原始链上回执、投票详情与状态机回读快照均归档在 `audit-package/` 目录中：

| 文件名称 | 物理大小 (Bytes) | SHA-256 完整性哈希 | 核心用途与说明 |
| :--- | :-: | :--- | :--- |
| `transaction_receipts.json` | 681,506 | `6ee2df5025aa2a9c96b89837eea7dac33b3f2b93392f67d8eed01c5603620f0b` | 5 笔交易完整 RPC 底层回执 |
| `consensus_votes.json` | 86,162 | `4322b63304ac5c3888f7c54bbaa409c2a0faf267fa4910688085c7667c39dc01` | 两笔探测交易全部验证者投票分布 |
| `readback_results.json` | 4,116 | `8ef334ac1b2802a0d3b839bd85845d9511608586d67075fbce50989bddf2a888` | LATEST_FINAL 状态前后读回比对快照 |
| `fee_audit.json` | 4,948 | `5f17d946bdb2156db3b514f950434cbdb42f23bb7c7f443b59232c0794b10732` | 区分 gasUsed 与 actualFeePaid 的费用审计 |
| `git_security_audit.md` | 8,433 | `f8b4c5197649adedef5ef7e2eeda57a98b1d98af1bd3838db221aa8978162971` | 工作区与 Git 历史安全扫描与私钥 0 泄露报告 |
| `git_history.txt` | 1,030,567 | `9162d4c4efadb33f40e9126237e2778f6aad3e8db9961e7a03c86b7a844c1e8f` | 截止至 Commit `d08fc2e` 的完整提交历史补丁快照 |

> [!NOTE]
> `git_history.txt` 记录截止到 Commit `d08fc2e5bd5cb6ff57181526eae46d64b8f16c6f` 为止的补丁历史快照，避免自身提交导致的循环自引用。

---

## 已知技术限制

1. **HTTP 重定向限制**：GenVM 底层 `gl.nondet.web.get` 当前实现默认不跟随 301/302 重定向。若目标 URL 发生跳转，将返回重定向状态码并触发非 200 异常。
2. **正文字节未达成共识**：等价性逻辑当前仅覆盖状态码与存活性，链上持久化的 `sample` 为 Leader 单点采样，不具备逐字节全体验证者共识。
3. **网络依赖**：仅适配 GenLayer Stable Studionet（Chain ID `61999`），不支持其他未配置非确定性 Web 模块的传统 EVM 网络。

---

## 许可证

本项目采用 MIT 许可证开源，详情参阅 [LICENSE](./LICENSE)。
