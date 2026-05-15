# Session Prompts 汇总

本 session 共 35 条 prompt，覆盖从项目启动到最终交付的完整流程。

---

## 阶段推进

1. @session-export.zip 阅读整个项目 并查看压缩包里的内容（之前session的对话） 明确我要做什么 最终要求是什么
2. 开始（Stage 1）
3. 进入（Stage 2）
4. 我已经安装了npm 你先把已有提交推送到远程仓库吧
5. 怎么没看到你写的程序文件呢 直接在main分支写就好 然后推送用 ssh 443来推
6. 先告诉我完成了哪些 还剩下哪些
7. （审查结论）Stage 1 有条件通过，Stage 2 需要修复后再继续…
8. 开始Stage 3
9. （审查结论）Stage 3 基本通过，可以继续 Stage 4…
10. 开始 Stage 4
11. （审查结论）Stage 4 通过，可以继续 Stage 5…
12. 开始 Stage 5
13. （审查结论）Stage 5 不通过，需要先修 Agent 回答质量…
14. （审查结论）Stage 5 修复后通过，可以继续 Stage 6…
15. 进入 Stage 6
16. （审查结论）Stage 6 通过，可以继续 Stage 7…
17. 开始 Stage 7
18. （审查结论）Stage 7 通过，可以继续 Stage 8…

## 深度审查与优化

19. 先不要zip 深度阅读项目，看看哪里还有问题 或是还可以优化
20. 先做交付必需项 — README_RUN.md、prompt/、screenshot/ 目录
21. 继续做优化项（提取 test helper、generic intent 兜底、TF-IDF 缓存）

## 最终审查与修复

22. （审查结论）总体结论：项目核心功能基本完成，但还没有达到'最终可提交'的完整状态（smoke health/简历/prompt截图/推送/打包）
23. 我放入了真实简历
24. 在main分支上提交推送 不要把简历推送到远程仓库
25. 截图我自己来 你先把其他问题解决一下
26. 我看了一遍，结论是：整体已经比较完整…（30条建议：README格式/Prettier/Agent可信度/自动索引/reason字段/tool封装/多轮/nav/score上限/白名单/错误格式等）
27. 继续30条建议（P0对齐/格式化/类型定义/领域配置/安全优化/前端trace/测试增强/代码拆分）
28. 一一审核 看看有没有达到要求（逐条对照 Phase 1/2/3 验收用例验证）

## 100 SOP 与索引

29. 主要问题：parseIndexKeywords 写死 1..10、要支持题目说的100份SOP
30. （审查结论）仍需注意的问题：自动关键词质量偏英文、safeReadFile 扩展名白名单…
31. 1. 在 README_RUN.md 里补一句：sop-index.md 会自动生成/刷新。2. 为100份SOP索引解析加专门测试

## Agent 路由修正

32. /screenshot 我自己运行后截了图 有些结果不对 你看看什么问题（Agent路由：推荐质量下降被路由到 QA而非AI）
33. GET /v2/search?q=服务器挂了：sop-001 和 sop-004 靠前。这个要求算满足吗
34. 问题出在 多轮上下文拼接策略过于粗暴，不是 Agent 单轮路由本身的问题。这里你觉得应该怎么处理

## 收尾

35. 你可以导出在这个session中我说的所有的prompt吗
