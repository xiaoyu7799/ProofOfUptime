# GenLayer Phase 4 — ProofOfUptime 部署与执行证据报告

**项目仓库**：https://github.com/xiaoyu7799/ProofOfUptime  
**目标网络**：GenLayer Stable Studionet（Chain ID: `61999`）  
**合约地址**：`0x613Ccb8a943179c0d56c2A194F69261f7108F82A`  
**测试账户**：`0x6F893325Bf28E3Eaa97d35Ced1780B8C4623C121`  
**初始实现 Commit**：`cc4b6cf6e64ae0e6105ad8649e765001eefdccf4`  

本报告记录初始部署、目标注册及首次负向探测证据。完整五笔交易、费用审计和最终状态读回以 [最终闭环报告](./GENLAYER_PHASE4_FINAL_CLOSURE_REPORT.md) 与 `audit-package/` 中的原始材料为准。

---

## 一、部署与初始写入

| 操作 | 交易哈希 | 结果 |
| :--- | :--- | :--- |
| 合约部署 | `0x95062b39e8cae8be5307927b445728c34529353c264e57c167283bd63a4c8bcb` | FINALIZED |
| 注册 Target 0 | `0xd541429e2aebce353ff8fb82daf677675d82d5ce17468e8816df2dd3296ec976` | FINALIZED |
| 探测 Target 0 | `0xc53d6b6eb5e8d1e37a2707ec5f3e2615c49b000634ff6b195f5f25f78b5b6fa8` | FINALIZED / MAJORITY_DISAGREE |

全部状态以链上交易归档中的 `transaction.status = 7` 和 `statusName = FINALIZED` 字段为依据。

## 二、Target 0 负向探测的真实原因

Target 0 使用的地址为 `https://1.1.1.1`。原始共识记录中的 GenVM 错误为：

- 错误码：`TLD_FORBIDDEN`
- 上下文：`tld = "1"`
- 发生阶段：GenVM URL 策略检查
- HTTP 响应：未取得

因此，这次负向探测**不是已观察到的 HTTP 301 响应**。共识记录显示 5 个验证者中 3 票 Disagree、2 票 Idle，最终结果为 `MAJORITY_DISAGREE`。链上读回显示 Target 0 仍为 `registered`，`probed_count = 0`。

该证据证明了这次非确定性执行因 URL 策略拒绝而未能通过共识；它不证明目标服务器返回了 301，也不作为 HTTP 重定向行为的测试结果。

## 三、合约状态与等价性逻辑

合约使用 `TreeMap[u256, str]` 保存目标数据，并通过 `target_count` 维护目标数量。

- `register_target`：校验名称长度、HTTPS 协议和 URL 长度。
- `probe_target`：调用 `gl.nondet.web.get`，并通过 `gl.vm.run_nondet_unsafe(fetch, validate)` 执行非确定性共识。
- `validate`：比较 Leader 与 Validator 独立抓取的 `status_code` 和 `is_alive`。
- `sample`：只作为 Leader 响应样本保存，不参与 Validator 等价性比较。

状态更新发生在 `run_nondet_unsafe` 返回之后；未通过共识的探测不会把目标状态更新为 active。

## 四、费用证据

Stable Studionet（Chain ID 61999）归档记录显示，五笔交易的 `gasUsed` 为 8,000,000，`effectiveGasPrice` 为 0，实际手续费为 0 WEI。Gas 使用量与实际支付费用分别记录，不将两者混为一谈。

## 五、测试范围与复现方式

当前离线回归测试覆盖：

- 合约源码结构、公开方法装饰器和注册参数约束；
- `run_nondet_unsafe` 与 `validate` 的关键调用关系；
- 五笔交易哈希、FINALIZED 状态、共识投票、费用数据和 LATEST_FINAL 读回的一致性；
- 安全扫描器的凭证识别、路径脱敏、PASS/FAIL 判定与 `.gitignore` 覆盖。

运行命令：

`npm test`  
`npm run scan:security`  
`python -m py_compile contracts/ProofOfUptime.py`

这些是离线源码与证据回归检查，不等同于 GenVM 运行时集成测试或本轮重新发起的 Studionet RPC 验收。本轮工程整改不修改合约，不新增链上交易。

## 六、安全与环境边界

- 测试钱包私钥仅用于本地隔离环境；公开仓库不包含私钥内容。
- `.secrets/wallet.json` 由 `.gitignore` 排除。
- SDK 签名与地址恢复记录属于离线密码学测试，不代表浏览器钱包扩展端到端验收。
- 公开 Faucet 的交互式登录与人机验证不作为自动化测试结果。

## 七、证据文件

- `audit-package/transaction_receipts.json`：交易与 RPC 回执。
- `audit-package/consensus_votes.json`：验证者投票与共识结果。
- `audit-package/readback_results.json`：LATEST_FINAL 状态读回。
- `audit-package/fee_audit.json`：Gas 使用量与实际费用。
- `audit-package/git_security_audit.md`：仓库安全扫描报告。
- `audit-package/git_history.txt`：脱敏提交历史摘要。
