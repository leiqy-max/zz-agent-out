# Git 全流程开发指南 (从同步到分支)

这份文档涵盖了从代码下载、日常开发同步，到进阶分支管理的所有核心操作。

---

## 第一部分：代码同步与日常开发

### 1. 基础配置（新电脑只需做一次）
*   **配置身份**：
    ```bash
    git config --global user.name "你的用户名"
    git config --global user.email "你的邮箱"
    ```
*   **生成 SSH 密钥**（用于免密连接）：
    ```bash
    ssh-keygen -t ed25519 -C "你的邮箱"
    # 然后将 ~/.ssh/id_ed25519.pub 的内容添加到 GitHub Settings -> SSH Keys
    ```

### 2. 获取代码
*   **首次下载 (Clone)**：
    如果你电脑上还没有代码，使用此命令将远程仓库整个下载下来。
    ```bash
    git clone git@github.com:leiqy-max/zz-agent-out.git
    ```
*   **日常更新 (Pull)**：
    **每天开始工作前**，或者在公司写了代码回家后，先运行这个命令，把最新代码拉取到本地。
    ```bash
    git pull
    ```

### 3. 日常提交“三板斧”
每次修改完代码（比如写完了功能或修好了 Bug），执行以下三步将改动保存并上传：

1.  **添加到暂存区**：
    ```bash
    git add .
    ```
2.  **提交到本地仓库**：
    ```bash
    git commit -m "这里写清楚你做了什么修改"
    ```
3.  **上传到 GitHub**：
    ```bash
    git push
    ```

---

## 第二部分：分支管理 (Branch)

### 1. 什么是分支？
想象代码是一棵树的主干（`main`）。为了不影响主干的稳定性，我们在开发新功能时，会从主干上长出一个“新树枝”（分支）。在树枝上怎么改都不会影响主干，直到你觉得满意了，再把它“嫁接”（合并）回去。

### 2. 常用命令速查

| 你的目的 | 终端命令 | 说明 |
| :--- | :--- | :--- |
| **查看分支** | `git branch -a` | 列出所有分支。当前所在分支前有 `*` 号。 |
| **创建并切换** | `git checkout -b <新分支名>` | **最常用**。新建并立即跳转到新分支。 |
| **切换分支** | `git checkout <分支名>` | 在已有分支间切换（例如回 `main`）。 |
| **删除分支** | `git branch -d <分支名>` | 删除不再需要的分支（不能删当前所在的）。 |
| **合并分支** | `git merge <分支名>` | 把别的分支合并到当前分支。 |

### 3. 实战场景演示

#### 场景 A：开发一个新功能
1.  **新建分支**：先切出新分支 `feature-login`。
    ```bash
    git checkout main          # 确保以 main 为基础
    git checkout -b feature-login
    ```
2.  **开发提交**：在这个分支上安心写代码，写完后执行“三板斧”（add, commit）。
3.  **合并上线**：
    ```bash
    git checkout main          # 1. 回到主分支
    git pull                   # 2. 习惯性更新一下主分支代码
    git merge feature-login    # 3. 把 feature-login 的成果合并过来
    git push                   # 4. 推送合并后的主分支到 GitHub
    ```
4.  **清理**：
    ```bash
    git branch -d feature-login
    ```

#### 场景 B：分享你的分支
如果你想把 `feature-login` 分支推送到 GitHub 上给同事看，而不是合并进 main：
```bash
git push origin feature-login
```

---

## 常见问题排查

*   **git push 报错？**
    如果提示 `fetch first`，说明 GitHub 上有你本地没有的更新。
    **解决方法**：先运行 `git pull`，解决可能产生的冲突，然后再 `git push`。

*   **不知道自己改了哪些文件？**
    随时运行 `git status` 查看当前状态。
