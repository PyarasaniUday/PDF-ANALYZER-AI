# 🚀 AI PDF Analyzer

An intelligent web application that allows users to upload PDF documents and extract meaningful insights using AI. The system provides summaries, keywords, interactive chat, and quiz generation — all from a single document.

---

## 🎯 Project Objective

The main aim of this project is to:

* Simplify understanding of large PDF documents
* Extract key information automatically
* Enable users to interact with document content using AI
* Provide learning support through quiz generation

---

## 💡 Key Features

* 📄 Upload and analyze PDF files
* 🧠 Generate concise summaries
* 🔍 Extract important keywords
* 💬 Chat with document (AI assistant)
* 📝 Auto-generate quizzes from content
* 📊 Display document insights and statistics
* 🗂 Save analysis history

---

## 🛠️ Technologies Used

### 🔹 Backend

* Python
* Flask
* PyPDF2 (PDF text extraction)
* NLTK (keyword extraction & NLP)
* Sumy (LSA summarization)
* Google Generative AI (Gemini API)

### 🔹 Frontend

* HTML
* CSS
* JavaScript

### 🔹 Database

* SQLite

### 🔹 Other Tools

* dotenv (environment variables)
* Werkzeug (authentication security)

---

## 🧠 How It Works (System Flow)

### Step 1: Upload PDF

* User uploads a PDF file via frontend
* File is stored in `uploads/` directory

### Step 2: Text Extraction

* `PyPDF2` reads all pages
* Extracts raw text from each page

### Step 3: Processing & Analysis

* Text is cleaned and processed
* Split into manageable chunks (for large PDFs)

### Step 4: Summary Generation

* Uses **LSA (Latent Semantic Analysis)** via Sumy
* Extracts most important sentences
* Produces a concise summary

### Step 5: Keyword Extraction

* Uses NLTK:

  * Tokenization
  * Stopword removal
  * POS tagging
* Extracts most frequent meaningful words

---

## 🧠 Handling Large PDFs

Large PDFs are handled efficiently by:

* Processing page-by-page
* Limiting text length for summarization
* Generating page-level insights
* Avoiding memory overload

This ensures:

* Faster performance
* Stable execution
* Scalable processing

---

## 💬 Chat Assistant (AI Interaction)

* Uses Google Gemini API
* Combines:

  * Document summary
  * Page insights

### Flow:

1. User asks a question
2. System builds context from document
3. Sends prompt to AI model
4. AI generates relevant answer

👉 If answer not in document → AI uses general knowledge

---

## 📝 Quiz Generation

* Based on document summary
* Uses AI model to generate:

  * Multiple choice questions
  * Options
  * Correct answers

### Flow:

1. Summary sent to AI
2. AI generates structured JSON questions
3. Parsed and displayed in UI

---

## 📂 Project Structure

```
PDF-ANALYZER/
│
├── static/
│   ├── script.js
│   ├── style.css
│
├── templates/
│   ├── index.html
│
├── uploads/
│
├── app.py
├── database.db
├── .env
├── .gitignore
```

---

## ⚙️ Setup Instructions

### 1. Clone the Repository

```
git clone <your-repo-link>
cd PDF-ANALYZER
```

### 2. Install Dependencies

```
pip install -r requirements.txt
```

### 3. Add API Key

Create `.env` file:

```
GOOGLE_API_KEY=your_api_key_here
```

### 4. Run Application

```
python app.py
```

Open browser:

```
http://127.0.0.1:5000
```

---

## 📈 Importance of the Project

* Helps students understand large study materials quickly
* Useful for professionals handling long documents
* Demonstrates real-world AI integration
* Showcases full-stack development skills

---

## 🚀 Future Enhancements

* Highlight answers inside PDF
* Voice-based interaction
* Multi-PDF comparison
* Cloud deployment (Render / AWS)
* Advanced NLP models

---

## 👨‍💻 Author

Developed by **Uday**

---

## ⭐ Conclusion

This project demonstrates how AI can be used to transform static documents into interactive, intelligent systems — making information easier to understand, explore, and learn.

---
