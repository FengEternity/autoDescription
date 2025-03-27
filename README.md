# Auto Description

一个用于 Obsidian 的插件，可以使用 Kimi AI 自动为文章生成摘要，并将其添加到文章的 Front Matter 中。

## 功能特点

- 使用 Kimi (Moonshot) API 生成高质量的文章摘要
- 自动将摘要添加到文章的 Front Matter 的 description 字段
- 支持自定义摘要长度和提示词
- 支持多种 Moonshot 模型选择
- 简单易用的设置界面

## 安装方法

1. 在 Obsidian 中打开设置
2. 进入第三方插件设置
3. 关闭安全模式
4. 点击"浏览"进入社区插件市场
5. 搜索"Auto Description"并安装

## 使用方法

1. 安装插件后，首先在插件设置中配置你的 Kimi API 密钥
2. 在任意文章中，使用命令面板（Cmd/Ctrl + P）
3. 输入"生成文章摘要"并执行
4. 插件会自动生成摘要并添加到文章的 Front Matter 中

## 配置选项

- **API 密钥**：你的 Kimi API 密钥，可从 [Moonshot 控制台](https://platform.moonshot.cn/console/api-keys) 获取
- **模型选择**：
  - Moonshot V1 8K：适用于一般长度的文章
  - Moonshot V1 32K：适用于较长文章
  - Moonshot V1 128K：适用于超长文章
- **摘要长度**：可设置 50-500 字之间的摘要长度
- **自定义提示词**：可自定义生成摘要时的提示词模板

## 注意事项

- 使用前请确保已获取有效的 Kimi API 密钥
- 建议根据文章长度选择合适的模型
- 生成的摘要会自动替换已有的 description 字段
- 如果文章没有 Front Matter，插件会自动创建

## 开发计划

- [ ] 支持更多 AI 模型接口
- [ ] 添加批量处理功能
- [ ] 支持更多自定义选项
- [ ] 优化摘要生成质量

## 问题反馈

如果你在使用过程中遇到任何问题，或有任何建议，欢迎在 GitHub 上提出 Issue。
