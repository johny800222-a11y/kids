# 🌈 小譯王 — 兒童翻譯 PWA

免費網頁版，部署到 GitHub Pages，iPhone/iPad 可「加入主畫面」當 App 使用。

## 📁 檔案結構

```
KidsTranslatorWeb/
├── index.html          ← 主頁面
├── manifest.json       ← PWA 設定
├── sw.js               ← Service Worker（離線快取）
├── css/
│   └── kids.css        ← 可愛兒童介面
├── js/
│   ├── translate.js    ← 翻譯服務（離線+線上）
│   ├── voice.js        ← 語音辨識 + 對話翻譯
│   ├── camera.js       ← 相機 + OCR（Tesseract.js）
│   ├── wordbook.js     ← 單字書 + 翻卡
│   └── app.js          ← 主控制器
├── data/
│   └── words_zh_en.json ← 教育部國小1000單字
└── icons/
    ├── icon-192.svg
    └── icon-512.svg
```

---

## 🚀 部署到 GitHub Pages（5分鐘）

### 步驟 1 — 建立 GitHub Repository

1. 前往 [github.com](https://github.com) → 登入
2. 右上角 **+** → **New repository**
3. Repository name: `kids-translator`（或任何名字）
4. 設定為 **Public**
5. 按 **Create repository**

### 步驟 2 — 上傳檔案

**方法 A：直接拖拉（最簡單）**
1. 打開剛建立的 repository
2. 點 **uploading an existing file**
3. 把整個 `KidsTranslatorWeb` 資料夾裡的檔案**全部拖進去**（注意：子資料夾 css/js/data/icons 也要）
4. 按 **Commit changes**

**方法 B：用 Terminal**
```bash
cd KidsTranslatorWeb
git init
git add .
git commit -m "初始版本"
git remote add origin https://github.com/你的帳號/kids-translator.git
git push -u origin main
```

### 步驟 3 — 開啟 GitHub Pages

1. Repository → **Settings** → 左側 **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / `/ (root)`
4. 按 **Save**
5. 等約 1 分鐘，網址會顯示在頁面上，格式為：
   ```
   https://你的帳號.github.io/kids-translator/
   ```

---

## 📱 iPhone 加入主畫面

1. 用 **Safari** 打開上面的網址
2. 點底部 **分享**（方框＋箭頭）
3. 選 **加入主畫面**
4. 名稱填「小譯王」→ 按**新增**
5. 桌面會出現 App 圖示，點開就像真的 App！

---

## 功能說明

| 分頁 | 功能 | 是否需要網路 |
|------|------|------------|
| ✏️ 文字 | 即時輸入翻譯（400ms debounce）| 離線可查1000字，其餘需網路 |
| 📷 相機 | 拍照OCR文字辨識後翻譯 | OCR需網路（Tesseract.js CDN）|
| 🎙️ 語音 | 說話→辨識→翻譯→朗讀 | 需網路（Web Speech API）|
| 💬 對話 | 面對面雙向口說翻譯 | 需網路 |
| 📚 單字書 | 1045單字+例句+翻卡+收藏 | **完全離線** |

---

## 自訂顏色主題

修改 `css/kids.css` 頂部的 CSS 變數：
```css
:root {
  --coral:  #FF6B6B;  /* 主色 */
  --mint:   #4ECDC4;  /* 相機色 */
  --purple: #A29BFE;  /* 語音色 */
}
```
