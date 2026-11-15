# GenLayer Phase 4 — ProofOfUptime 最终工程整改与验收报告

**项目仓库**：[xiaoyu7799/ProofOfUptime](https://github.com/xiaoyu7799/ProofOfUptime)  
**分支**：`master`  
**目标网络**：GenLayer Stable Studionet（Chain ID: `61999`）  
**合约地址**：`0x613Ccb8a943179c0d56c2A194F69261f7108F82A`  
**审计快照 HEAD**：`caa2cb344110461c1328b2684f07fa120ba73a9f`  
**综合结论**：**工程整改与远程 CI 验收通过；历史链上证据保留；本轮未重新部署、未发起链上交易、未执行实时 Studionet RPC。**

---

## 一、交付状态

| 验收维度 | 结果 | 依据 |
| :--- | :---: | :--- |
| 历史链上证据 | **保留并交叉核验** | 五笔历史交易均记录为 FINALIZED（状态码 7）；原始回执、共识、费用和 LATEST_FINAL 读回材料保留 |
| 工程整改 | **PASS** | 安全扫描器修复、标准 MIT License、报告更正、历史摘要脱敏、回归测试补齐 |
| 自动化测试 | **PASS** | GitHub Actions 执行 Python 10 项回归测试、Node 安全扫描器测试和安全审计 |
| GitHub 远程仓库 | **PASS** | master 分支已推送，远程提交与 CI 记录可查 |

**本轮严格不修改合约，不重新部署，不产生任何新链上交易。** 链上部分属于对已有证据的只读复核，不宣称本轮重新向 Studionet 发起 RPC 验收。

## 二、关键整改记录

1. **安全扫描器**：扫描结果现在实际驱动 PASS/FAIL 和进程退出码；检查工作区、Git 补丁历史、凭证特征、PEM 私钥、可用的钱包指纹及 .gitignore 规则。
2. **MIT License**：补齐标准 MIT 许可证正文与版权声明。
3. **测试**：新增合约 AST 结构检查、非确定性共识调用检查、五笔交易与 FINALIZED 状态校验、验证者投票、费用和 LATEST_FINAL 读回一致性测试。
4. **事实纠正**：Target 0 的真实失败原因是 GenVM URL 策略错误 `TLD_FORBIDDEN`（`tld = "1"`），没有取得 HTTP 响应；此前写成 HTTP 301 的描述已从 README、验收报告和证据摘要中纠正。
5. **公开文件清理**：历史验收报告中的本机绝对路径已清理；`git_history.txt` 改为脱敏提交元数据与 diffstat 摘要，不再公开完整补丁正文。

## 三、五笔历史链上交易

| # | 操作 | 交易哈希 | 状态 | 共识结果 |
| :-: | :--- | :--- | :---: | :--- |
| 1 | 合约部署 | `0x95062b39e8cae8be5307927b445728c34529353c264e57c167283bd63a4c8bcb` | FINALIZED (7) | MAJORITY_AGREE |
| 2 | 注册 Target 0 | `0xd541429e2aebce353ff8fb82daf677675d82d5ce17468e8816df2dd3296ec976` | FINALIZED (7) | MAJORITY_AGREE |
| 3 | 探测 Target 0 | `0xc53d6b6eb5e8d1e37a2707ec5f3e2615c49b000634ff6b195f5f25f78b5b6fa8` | FINALIZED (7) | MAJORITY_DISAGREE |
| 4 | 注册 Target 1 | `0xf40b36b0d857f03039207a5c0f124d00e7c1ebf916a4dd00f036d7f1430c4ae7` | FINALIZED (7) | MAJORITY_AGREE |
| 5 | 探测 Target 1 | `0x03c5b525e12f81cf36f64edc30095af6fd0bfe3b921097b34e3b2a70e4865960` | FINALIZED (7) | MAJORITY_AGREE |

### 共识结果与状态读回

- Target 0：GenVM 在 URL 策略检查阶段返回 `TLD_FORBIDDEN`，不是 HTTP 301；5 个验证者中 3 票 Disagree、2 票 Idle。LATEST_FINAL 读回为 `registered`，`probed_count = 0`。
- Target 1：Drand URL 返回 HTTP 200；5 个验证者中 3 票 Agree、2 票 Idle。LATEST_FINAL 读回为 `active`，`probed_count = 1`，`last_result.status_code = 200`。
- `validate()` 比较 `status_code` 与 `is_alive`；`sample` 仅作为 Leader 样本保存，不参与逐字节等价性比较。

### Gas 费用

五笔交易的归档记录均为 `gasUsed = 8,000,000`、`effectiveGasPrice = 0`、实际手续费 `0 WEI`。Gas 使用量与实际支付费用分开记录。

## 四、自动化测试与安全审计

GitHub Actions：  
[ProofOfUptime CI — run 43766961040](https://github.com/xiaoyu7799/ProofOfUptime/actions/runs/43766961040)

| 检查项 | 实际结果 |
| :--- | :--- |
| Python 合约语法编译 | PASS |
| Python 源码与链上证据回归 | 10/10 PASS |
| Node 安全扫描器单元测试 | PASS |
| 仓库文件扫描 | 31 个文件，0 项发现 |
| Git 补丁历史凭证扫描 | 0 项发现 |
| .gitignore 规则验证 | 9/9 PASS |
| 钱包指纹比对 | SKIPPED：CI 无本地钱包文件，未虚报已验证 |

本轮测试属于离线源码与证据回归检查，不等同于 GenVM 运行时集成测试或实时链上 RPC 验收。

## 五、六份审计文件 SHA-256 完整性清单

以下哈希按仓库当前文件内容计算，字节数为 UTF-8 文件实际大小。

| 文件 | 字节数 | SHA-256 |
| :--- | ---: | :--- |
| `audit-package/transaction_receipts.json` | 681,506 | `6ee2df5025aa2a9c96b89837eea7dac33b3f2b93392f67d8eed01c5603620f0b` |
| `audit-package/consensus_votes.json` | 86,162 | `4322b63304ac5c3888f7c54bbaa409c2a0faf267fa4910688085c7667c39dc01` |
| `audit-package/readback_results.json` | 4,116 | `8ef334ac1b2802a0d3b839bd85845d9511608586d67075fbce50989bddf2a888` |
| `audit-package/fee_audit.json` | 4,948 | `5f17d946bdb2156db3b514f950434cbdb42f23bb7c7f443b59232c0794b10732` |
| `audit-package/git_security_audit.md` | 1,720 | `336b25a01811bed5f097ed976171f8da033a13fc663dc8ab3e54aead0578c64e` |
| `audit-package/git_history.txt` | 2,564 | `9b5a9f30ab47e4aaa5794b8bb73efb2fcfc298c3a9e2db70b6e705df650a5eee` |

## 六、提交与历史边界

- 工程整改提交：`911e28b396ce580caffc0d43bfba71e12ef5f777`
- 历史摘要与安全审计刷新提交：`caa2cb344110461c1328b2684f07fa120ba73a9f`
- 本报告对应的审计快照 HEAD：`caa2cb344110461c1328b2684f07fa120ba73a9f`
- 本报告自身随后的发布提交，以 GitHub `master` 分支最新 HEAD 为准。

**历史限制**：当前公开报告与提交摘要已清理本机绝对路径；为避免破坏原始提交链，本轮没有重写旧 Git commit objects，因此旧提交详情页的历史补丁仍可能保留早期路径文本。钱包指纹扫描在 CI 环境中未执行，因为没有本地钱包文件。

---

**最终判定：工程整改完成，远程 CI 通过，五笔既有链上交易与状态证据保留；未新增链上交易。**
