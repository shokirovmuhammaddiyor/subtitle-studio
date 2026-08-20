# Subtitle Studio Pro 🎬

> **100% Client-Side Subtitle Suite** — Vite va GitHub Pages uchun mo'ljallangan, bir necha GB lik videolardan butun faylni yuklamasdan faqat bir necha KB ma'lumot o'qish orqali subtitrlarni ajratib oluvchi va barcha formatlar bilan ishlovchi universal asboblar to'plami.

![Subtitle Studio Pro](https://img.shields.io/badge/Platform-GitHub%20Pages%20Ready-success)
![Vite](https://img.shields.io/badge/Vite-React%20%2B%20TypeScript-indigo)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 🌟 Asosiy Asboblar va Imkoniyatlar

### 1. 🎬 Video to Subtitle Extractor (MKV, MP4, WebM, MOV Range Demuxer)
- **HTTP Range Requests & File.slice**: 10–50 GB lik videoni to'liq yuklab olmasdan, faqatgina bir necha KB/MB metadata va subtitr bloklarini o'qish orqali barcha ichki subtitrlarni (ASS, SRT, VTT) ajratib oladi (99.99% internet tejaladi).
- **Murakkab URL'lar qo'llab-quvvatlovi**: Seedr CDN havolalari, Google Drive, to'g'ridan-to'g'ri HTTP/HTTPS media streamlar.
- **O'rnatilgan CORS Proxy Bypass**: Brauzerda CORS cheklovi bo'lgan havolalar uchun CORSProxy.io, AllOrigins va CodeTabs orqali yuklash.
- **Ko'p tilli treklarni ajratish**: Tili, trek raqami va formati bo'yicha saralash, har birini alohida yoki barchasini ZIP arxiv qilib yuklab olish.

### 2. 🔄 Universal Subtitle Converter
- `SRT ⟷ VTT ⟷ ASS ⟷ SSA ⟷ LRC (Qo'shiq matnlari) ⟷ SAMI ⟷ JSON ⟷ TXT (Transkript)`
- Formatlar orasida to'g'ridan-to'g'ri sifat yo'qotishsiz konvertatsiya qilish.

### 3. 🧹 Cleaner & HTML / Tag Stripper
- **HTML teglari**: `<i>`, `<b>`, `<u>`, `<font color="...">`, `<span>` va boshqalarni tozalash (yoki istalgan teglarni saqlab qolish).
- **ASS stillari**: `{\an8}`, `{\pos(x,y)}`, `{\c&H...&}` kabi effektlarni tozalash.
- **Qavslar**: Dumaloq `(...)`, to'rtburchak `[...]`, jingalak `{...}` qavslar ichidagi matnlarni tozalash (masalan: *(musiqa)*, *[QARSAKLAR]*).
- **SDH (Eshitishida nuqsoni borlar uchun izohlar)**: `JOHN: Hello`, `NARRATOR:` kabi so'zlovchi ismlari va tovush belgilarini tozalash.
- **Suv belgilari & Reklamalar**: Sayt nomlari (`OpenSubtitles`, `YIFY`), havolalar va maxsus kalit so'zlarni tozalash.
- **Registr**: Har bir gapni bosh harf bilan boshlash (Sentence case), Title Case yoki lowercase.

### 4. ⏱️ Time Shifter & FPS Resync
- Vaqtni surish: `± millisekund` yoki `± soniya`.
- FPS konvertatsiyasi: `23.976 ⟷ 24 ⟷ 25 (PAL) ⟷ 29.97 ⟷ 30 FPS`.

### 5. 🔀 Bilingual & Dual Subtitle Generator
- Ikki xil tildagi subtitrni bitta qilib birlashtirish (masalan: yuqori qismda Inglizcha, pastki qismda O'zbekcha).

### 6. 🔗 Joiner & Splitter
- CD1 va CD2 qismlarni vaqtini avtomatik to'g'rilab birlashtirish yoki katta faylni ma'lum daqiqadan ikkiga bo'lish.

### 7. 👁️ Live Video Player & Cue Editor
- HTML5 Video pleyer, real vaqt rejimida subtitrlarni video ustida ko'rish va replikalarni to'g'ridan-to'g'ri tahrirlash.

### 8. 🌐 AI & Translator Studio
- ChatGPT / Gemini / DeepL uchun toza matn transkriptini ajratib olish va tarjima qilingan matnni qaytadan asl vaqt kodlariga bir zumda birlashtirish.

### 9. 📊 Quality & Overlap Validator
- Vaqt to'qnashuvlari (overlap) va o'qish tezligi (CPS) me'yordan oshgan replikalarni avtomatik aniqlash va 1-bosishda tuzatish (Auto-Fix).

---

## 🚀 Ishga tushirish (Local Development)

```bash
# Loyihaga kirish
cd /home/admin/Desktop/subtitle

# Kutubxonalarni o'rnatish
npm install

# Dasturni ishga tushirish
npm run dev
```

Brauzerda `http://localhost:5173` manzilida ochiladi.

---

## 🌐 GitHub Pages ga Joylash (Deployment)

1. GitHub'da yangi ombor (repository) oching.
2. Loyihani GitHub'ga yuklang:
```bash
git init
git add .
git commit -m "feat: Subtitle Studio Pro suite"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO_NAME.git
git push -u origin main
```
3. GitHub omboringizda **Settings -> Pages** bo'limiga kiring:
   - **Source**: `GitHub Actions` ni tanlang.
4. `.github/workflows/deploy.yml` orqali dastur avtomatik ravishda GitHub Pages'ga joylanadi va bepul ishlaydi!
