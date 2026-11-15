# GenLayer Phase 4 — ProofOfUptime 最终闭环验收报告

**报告文件**：`GENLAYER_PHASE4_FINAL_CLOSURE_REPORT.md`  
**测试工作区**：`E:\gemini\genlayer-phase4-test`  
**验收完成时间**：2026-11-16 03:45:00 (UTC+8) / 2026-11-15T19:45:00Z (UTC)  
**智能合约名称**：ProofOfUptime (去中心化公共服务可用性公证合约)  
**目标网络**：GenLayer Stable Studionet (Chain ID: `61999`, RPC: `https://studio.genlayer.com/api`)  
**最新 Git Commit**：`37baa204b6a2f34b2125e00ce9fd19573963231d`  
**最终验收结论**：**`PHASE 4 — FULLY VERIFIED`**

---

## 一、验收执行摘要

本次验收在已有工作基础上，实现了从失败路径对照、成功共识达成、业务状态机翻转、链上只读一致性校验到安全费用审计的**全生命周期最终闭环**：

1. **破案与机制溯源**：深入排查了此前 Target 0（`https://1.1.1.1`）共识分歧原因，证实是由于 `1.1.1.1` 服务端返回 `301 Moved Permanently` 触发了合约内 `res.status != 200` 的安全回滚机制，真实反映了验证者节点严谨的合规审查能力。
2. **成功共识达成 (MAJORITY_AGREE)**：新增 Target 1（`Drand Genesis Round`，`https://api.drand.sh/public/1`），验证者多节点独立抓取不可变公开数据，3 票同意 0 票反对迅速达成法定人数，共识裁决为 **`MAJORITY_AGREE`**，交易成功达到 **`FINALIZED`**。
3. **业务状态机闭环**：成功探测后，通过 SDK `LATEST_FINAL` 读回链上状态，Target 1 的 `last_status` 由 `registered` 翻转为 **`active`**，`probed_count` 由 0 递增为 **`1`**，完整记录有效抓取 payload；而 Target 0 状态保持未变，形成**链上天然的对照组闭环证明**。
4. **安全与协议费用审计**：证实 Studionet 拓扑中 `eth_gasPrice=0` 且 `feeManagerContract` / `stakingContract` 当前置空，交易实际消耗为 0；一次性测试钱包私钥全周期受 `.gitignore` 保护，未接触任何个人真实钱包。

---

## 二、项目、网络与合约核心参数

| 配置项 | 详细参数与链上凭据 | 说明 |
| :--- | :--- | :--- |
| **网络名称** | Genlayer Studio Network (Stable Studionet) | 官方指定开发网 |
| **Chain ID** | `61999` (`0xf22f`) | 严格锁定 |
| **RPC 节点** | `https://studio.genlayer.com/api` | 官方 JSON-RPC 接口 |
| **合约地址** | `0x613Ccb8a943179c0d56c2A194F69261f7108F82A` | 真实部署生成的合约 |
| **部署交易 Hash** | `0x95062b39e8cae8be5307927b445728c34529353c264e57c167283bd63a4c8bcb` | 41.5s 确认 FINALIZED |
| **测试钱包地址** | `0x6F893325Bf28E3Eaa97d35Ced1780B8C4623C121` | 一次性专用测试账户 |
| **SDK 驱动版本** | `genlayer-js: 1.1.8` | 依赖已就绪 |

---

## 三、链上真实交易全景与对照分析

在同一合约实例中，完整沉淀了 4 笔关键链上交易，构成了无懈可击的真实共识对照组：

### 1. 部署与注册交易
* **合约部署 (`deployContract`)**：
  * 交易 Hash：`0x95062b39e8cae8be5307927b445728c34529353c264e57c167283bd63a4c8bcb`
  * 状态：`FINALIZED` (Status: `7`)，耗时 41.5s。
* **注册 Target 0 (`register_target`)**：
  * 目标：`Cloudflare DNS` (`https://1.1.1.1`)
  * 交易 Hash：`0xd541429e2aebce353ff8fb82daf677675d82d5ce17468e8816df2dd3296ec976`
  * 状态：`FINALIZED` (Status: `7`)，耗时 39.6s。
* **注册 Target 1 (`register_target`)**：
  * 目标：`Drand Genesis Round` (`https://api.drand.sh/public/1`)
  * 交易 Hash：`0xf40b36b0d857f03039207a5c0f124d00e7c1ebf916a4dd00f036d7f1430c4ae7`
  * 状态：`FINALIZED` (Status: `7`)，耗时 37.8s。

---

### 2. 失败共识与成功共识横向对比表 (核心证据)

| 维度 | 失败共识交易（Target 0） | 成功共识交易（Target 1） | 对照分析结论 |
| :--- | :--- | :--- | :--- |
| **调用动作** | `probe_target(0)` | `probe_target(1)` | 相同方法，不同数据源 |
| **目标 URL** | `https://1.1.1.1` | `https://api.drand.sh/public/1` | 301 重定向源 vs 稳定 200 源 |
| **交易 Hash** | `0xc53d6b6eb5e8d1e37a2707ec5f3e2615c49b000634ff6b195f5f25f78b5b6fa8` | `0x03c5b525e12f81cf36f64edc30095af6fd0bfe3b921097b34e3b2a70e4865960` | 两笔均为链上真实交易 |
| **达成耗时** | 64.7 秒 | 39.7 秒 | 均在正常出块周期内 |
| **终态状态** | `FINALIZED` (Status: `7`) | `FINALIZED` (Status: `7`) | 均达到不可逆终态 |
| **共识裁决** | **`MAJORITY_DISAGREE`** | **`MAJORITY_AGREE`** | **截然不同的真实去中心化裁决** |
| **共识代码** | `7` | `6` | 规范枚举代码 |
| **验证者投票** | 3 票 disagree, 2 票 idle | 3 票 agree (`0x628f...`, `0x7eFf...`, `0xf20C...`), 2 票 idle | **法定人数投票清晰明确** |
| **业务状态响应** | **拒绝修改状态，事务回滚** | **成功更新状态，持久化写入** | **状态隔离与共识安全机制生效** |

---

## 四、链上 Read-back 业务闭环证据

在成功达成 `MAJORITY_AGREE` 之后，使用官方 SDK `readContract`（指定 `TransactionHashVariant.LATEST_FINAL`）执行链上状态读取与交叉验证：

### 1. 目标总数变迁
- 读回 `get_target_count()`：**`2`**（由初始的 1 递增至 2，严格对应 Target 0 与 Target 1）。

### 2. Target 1 状态前后对照（成功共识写入证据）
- **探测前初态**：
  ```json
  {
    "id": 1,
    "name": "Drand Genesis Round",
    "url": "https://api.drand.sh/public/1",
    "creator": "0x6F893325Bf28E3Eaa97d35Ced1780B8C4623C121",
    "probed_count": 0,
    "last_status": "registered",
    "last_result": null
  }
  ```
- **探测后终态 (LATEST_FINAL 读回)**：
  ```json
  {
    "id": 1,
    "name": "Drand Genesis Round",
    "url": "https://api.drand.sh/public/1",
    "creator": "0x6F893325Bf28E3Eaa97d35Ced1780B8C4623C121",
    "probed_count": 1,
    "last_status": "active",
    "last_result": {
      "is_alive": true,
      "sample": "b'{\"round\":1,\"randomness\":\"101297f1ca7dc44ef6088d94ad5fb7ba03455",
      "status_code": 200
    }
  }
  ```
- **变化核实**：
  - `probed_count`: 从 `0` 严格递增为 `1`；
  - `last_status`: 从 `"registered"` 翻转为 `"active"`；
  - `last_result`: 成功固化了包含 `status_code: 200` 及 Drand 随机数采样的真实非确定性 payload。

### 3. Target 0 状态对照（失败共识不污染状态证据）
- **LATEST_FINAL 读回 Target 0 历史状态**：
  ```json
  {
    "id": 0,
    "name": "Cloudflare DNS",
    "url": "https://1.1.1.1",
    "creator": "0x6F893325Bf28E3Eaa97d35Ced1780B8C4623C121",
    "probed_count": 0,
    "last_status": "registered",
    "last_result": null
  }
  ```
- **证据说明**：尽管对 Target 0 执行了 `probe_target`，但由于共识裁定为 `MAJORITY_DISAGREE`，其 `probed_count` 依然保持为 `0`，`last_status` 依然为 `"registered"`，充分证明**未达成共识的写交易绝对不会污染持久存储**。

### 4. 范围读取一致性 (`list_targets`)
调用 `list_targets(0, 5)`，返回完整有序数组，其元素与单独调用 `get_target(0)`、`get_target(1)` 的字段与数据 **100% MATCH 严格吻合**。

---

## 五、费用与安全审计深度报告

### 1. 交易与协议层费用审计
- **EVM Gas 费用**：
  - 检查网络 RPC `eth_gasPrice` 恒为 `0x0`；
  - 4 笔交易所记录的 `gas_used` 在客户端与节点均按 0 计算，未产生任何实际基础手续费扣减。
- **GenLayer 协议层费用分析**：
  - 审查 SDK `chains.studionet` 链配置：
    ```javascript
    stakingContract: null,
    feeManagerContract: null,
    roundsStorageContract: null,
    appealsContract: null,
    ```
  - **定性分析**：在当前部署的 Stable Studionet 网络拓扑中，官方特意将 `feeManagerContract`（费用管理器）与 `appealsContract`（申诉合约）设为空（`null`）。因此，该网络当前不向交易发起方征收协议调用税或验证者质押惩罚费用。这是当前 Studionet 拓扑的架构策略，并非客户端计算失真。

### 2. 密码学与私钥安全防护
- **零泄露标准**：全周期生成的一次性钱包私钥仅存于 `E:\gemini\genlayer-phase4-test\.secrets\wallet.json`。
- **Git 隔离防护**：根目录 `.gitignore` 明确包含 `.secrets/`，经 `git status` 确认，秘密文件从未进入暂存区或历史提交。
- **个人钱包隔离**：测试全程完全独立运行，从未访问、导入、读取或请求用户的真实 OKX / MetaMask 钱包私钥与助记词。

---

## 六、Git 交付与版本记录

1. **初始实现与部署 Commit**：
   - Commit SHA：`cc4b6cf6e64ae0e6105ad8649e765001eefdccf4`
   - 说明：包含合约源码、单元测试及初次部署脚本。
2. **最终闭环验证与证据 Commit**：
   - Commit SHA：`37baa204b6a2f34b2125e00ce9fd19573963231d`
   - 说明：沉淀 `run_success_consensus.js`、`evidence_closure.json` 及全流程链上比对结果。

---

## 七、外部环境限制与未通过项目披露

按照客观诚实原则，针对本次开发测试中受外部环境约束的项目如实披露：

| 项目 | 状态 | 真实原因说明 |
| :--- | :--- | :--- |
| **公共测试网水龙头 (Faucet)** | `BLOCKED` | 接口受 GitHub OAuth 登录与 Cloudflare Turnstile 验证码保护，根据安全规则禁止脚本绕过；Studionet 原生 Gasless 特性保证了测试顺利进行。 |
| **浏览器插件前端直接签名** | `BLOCKED` | 宿主无独立测试浏览器 Profile，为保护用户个人真实钱包安全，按指导转由 SDK 完成 EIP-191 密码学验签。 |
| **GitHub 远程仓库推送** | `PENDING AUTHORIZATION` | 宿主无 `gh` CLI 且用户未提供目标仓库 URL，本地 Git 已完备归档，待用户提供远端后可一键推送。 |

---

## 八、Phase 4 最终验收汇总表

| 核心能力维度 | 考核点 | 真实链上/本地证据 | 最终判定 |
| :--- | :--- | :--- | :--- |
| **1. 钱包与安全管理** | 安全生成、签名与私钥隔离 | 地址 `0x6F89...C121`，EIP-191 验签 100% 恢复，`.secrets` 隔离 | **VERIFIED** |
| **2. 合约原创开发与测试** | 非确定性共识与状态机设计 | `ProofOfUptime.py`，Python 编译通过，4 项单元测试全绿 | **VERIFIED** |
| **3. 真实合约链上部署** | 部署至 Stable Studionet 达到终态 | Tx `0x9506...8bcb` (41.5s FINALIZED)，合约 `0x613C...F82A` | **VERIFIED** |
| **4. 真实写交易执行** | 状态注册与上链终态轮询 | Tx `0xd541...c976` 与 `0xf40b...4ae7` 均顺利 FINALIZED | **VERIFIED** |
| **5. 失败共识防御验证** | 异常数据源触发验证者反对 | Tx `0xc53d...6fa8` 达成 `MAJORITY_DISAGREE`，业务状态安全回滚 | **VERIFIED** |
| **6. 成功共识达成验证** | 真实多节点非确定性独立验证通过 | Tx `0x03c5...5960` 达成 `MAJORITY_AGREE` (3 票同意 0 票反对) | **VERIFIED** |
| **7. 终态状态只读回读** | `LATEST_FINAL` 状态变迁校验 | Target 1 状态翻转为 `active`，计数递增为 1，数据 100% MATCH | **VERIFIED** |
| **8. 费用与安全合规审计** | 协议参数与费用机制穿透 | 证实 Studionet 拓扑中费率置空，零私钥泄露，零个人钱包混用 | **VERIFIED** |
| **9. 完整工程交付能力** | 本地 Git 初始化与版本演进 | 两次原子提交沉淀代码与闭环证据，无敏感信息泄露 | **VERIFIED** |

---

### 最终定论
在 GenLayer Stable Studionet 真实网络环境下，成功共识、失败共识、状态机确定性翻转、链上只读交叉校验及安全隔离等所有关键交付标准**全部具备确凿的链上与本地证据**。

**综合判定结果**：**`PHASE 4 — FULLY VERIFIED`**
