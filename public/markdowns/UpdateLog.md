## 更新日志

### v1.1.1 - 新增日志功能、识别方式与加载优化 (2025‑06‑02)
- 支持动态创建的 Shadow DOM。
- 新增 placeholder、type、id 三种识别方式。
- 新增同步数据源功能，可自定义识别字段。
- 实现 localStorage 持久化本地存储机制，减少重复网络请求。
- 实现 Markdown 内容异步并行加载，提高页面响应速度。
- 实现单例日志系统，支持 INFO/WARN/ERROR 三级别。
- 支持控制台命令：EasyFillLogger.enable()、EasyFillLogger.disable()、EasyFillLogger.status()
- 根据环境自动调整日志输出（开发全开，生产仅输出警告与错误）。
- 提供链式配置接口，支持前缀、颜色、时间戳等灵活设置。
- 更新隐私权政策。

### v1.0.0 - 初次发布 (2025‑04‑07)
- 实现了自动填充评论表单，支持根据用户配置自动填写昵称、邮箱和网址。
- 提供了用户数据加密存储功能，确保昵称、邮箱和网址的隐私安全。
- 支持通过 Gravatar 显示用户头像。
- 支持插件选项卡内容以 Markdown 加载与渲染，包括推荐插件、关于作者、更新日志和隐私权政策。
- 优化了界面布局和用户体验，提供直观的设置页面。
- 已上架 Chrome 应用商店，搜索 EasyFill 可直接安装并使用。