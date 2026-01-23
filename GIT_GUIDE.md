# GitHub 代码更新指南

如果你在本地修改了代码（比如修改了 `content.js` 或 `README.md`），请按照以下步骤将更新推送到 GitHub 仓库。

### 1. 打开终端

在 VS Code 中，按 `Ctrl + \`` (反引号/波浪号键) 打开终端，或者在文件夹空白处右键选择 "Open in Terminal"。

### 2. 查看更改状态 (可选)

输入以下命令查看哪些文件被修改了：

```bash
git status
```

红色显示的文件就是你修改过但还没提交的文件。

### 3. 添加更改

将所有修改添加到暂存区：

```bash
git add .
```

> **注意**：`add` 后面有一个空格和一个点 `.`，代表当前目录下的所有文件。

### 4. 提交更改

将更改保存到本地历史记录，并附上说明（例如 "修复了一个bug"）：

```bash
git commit -m "这里写你的修改说明"
```

> **示例**：`git commit -m "优化了滑块速度"`

### 5. 推送到 GitHub

将本地的提交上传到 GitHub 远程仓库：

```bash
git push
```

---

### 🚀 极速连招 (复制粘贴用)

如果你不想记这么多，可以直接复制下面这三行命令一次性运行：

```bash
git add .
git commit -m "更新代码"
git push
```

### 常见问题

- **提示 `Everything up-to-date`**：说明没有新的提交需要推送。可能你忘了先 `git commit`。
- **提示 `LF will be replaced by CRLF`**：这是 Windows 和 Mac/Linux 换行符的差异警告，通常可以忽略。
