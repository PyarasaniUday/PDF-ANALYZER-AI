import os
import re
import json
import sqlite3
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from PyPDF2 import PdfReader
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.lsa import LsaSummarizer
import nltk
from nltk.corpus import stopwords
from collections import Counter
import google.generativeai as genai
from dotenv import load_dotenv, set_key

# Load environment initially
load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev_secret_key_123_abc")
app.config['UPLOAD_FOLDER'] = 'uploads'

app.config['DATABASE'] = 'database.db'
app.config['ENV_FILE'] = '.env'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# AI Configuration Global
AI_MODEL = None
GLOBAL_API_KEY = os.environ.get("GOOGLE_API_KEY")

def configure_ai(key):
    global AI_MODEL, GLOBAL_API_KEY
    if not key:
        return False
    try:
        genai.configure(api_key=key)
        # Using gemini-2.5-flash as it is supported
        AI_MODEL = genai.GenerativeModel('gemini-2.5-flash')
        GLOBAL_API_KEY = key
        return True
    except Exception as e:
        print(f"AI Config Error: {e}")
        return False

# Initial Config
configure_ai(GLOBAL_API_KEY)

# Initialize Database
def init_db():
    conn = sqlite3.connect(app.config['DATABASE'])
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  username TEXT UNIQUE, 
                  password TEXT,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    c.execute('''CREATE TABLE IF NOT EXISTS documents 
                 (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                  user_id INTEGER,
                  filename TEXT, 
                  filepath TEXT, 
                  summary TEXT, 
                  keywords TEXT, 
                  page_insights TEXT, 
                  stats TEXT, 
                  type TEXT DEFAULT 'pdf',
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY(user_id) REFERENCES users(id))''')
    try:
        c.execute("ALTER TABLE documents ADD COLUMN user_id INTEGER REFERENCES users(id)")
    except sqlite3.OperationalError:
        pass
    conn.commit()
    conn.close()

init_db()

# Keyword extraction setup
try:
    nltk.data.find('tokenizers/punkt')
    nltk.data.find('corpora/stopwords')
except (LookupError, AttributeError):
    nltk.download('stopwords')
    nltk.download('punkt')
    nltk.download('averaged_perceptron_tagger')
    nltk.download('punkt_tab')

def summarize_text(text, sentences_count=3):
    if not text or len(text) < 20: return text
    try:
        parser = PlaintextParser.from_string(text, Tokenizer("english"))
        summarizer = LsaSummarizer()
        summary = summarizer(parser.document, sentences_count)
        result = " ".join([str(sentence) for sentence in summary])
        return result if result else text[:200]
    except Exception as e:
        print(f"Summarization error: {e}")
        return text[:200]

def summarize_text_list(text, sentences_count=4):
    if not text or len(text) < 50: return [text]
    try:
        parser = PlaintextParser.from_string(text, Tokenizer("english"))
        summarizer = LsaSummarizer()
        summary = summarizer(parser.document, sentences_count)
        result = [str(sentence) for sentence in summary]
        return result if result else [text[:200]]
    except Exception as e:
        print(f"Summarization error: {e}")
        return [text[:200]]

def get_keywords(text, num=10):
    stop_words = set(stopwords.words('english'))
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    filtered_words = [w for w in words if w not in stop_words]
    try:
        tagged = nltk.pos_tag(filtered_words)
        significant_words = [word for word, pos in tagged if pos.startswith('NN') or pos.startswith('JJ')]
    except:
        significant_words = filtered_words
    counts = Counter(significant_words)
    return [word for word, count in counts.most_common(num)]

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    conn = sqlite3.connect(app.config['DATABASE'])
    c = conn.cursor()
    try:
        c.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, generate_password_hash(password)))
        conn.commit()
        session['user_id'] = c.lastrowid
        session['username'] = username
        return jsonify({'message': 'Registered successfully'})
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username already exists'}), 400
    finally:
        conn.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    conn = sqlite3.connect(app.config['DATABASE'])
    c = conn.cursor()
    c.execute("SELECT id, password FROM users WHERE username = ?", (username,))
    user = c.fetchone()
    conn.close()
    if user and check_password_hash(user[1], password):
        session['user_id'] = user[0]
        session['username'] = username
        return jsonify({'message': 'Logged in successfully'})
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully'})

@app.route('/auth-status', methods=['GET'])
def auth_status():
    if 'user_id' in session:
        return jsonify({'logged_in': True, 'username': session['username']})
    return jsonify({'logged_in': False})

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/ai-status', methods=['GET'])
def ai_status():
    return jsonify({
        'connected': AI_MODEL is not None,
        'hasKey': bool(GLOBAL_API_KEY)
    })

@app.route('/save-key', methods=['POST'])
def save_key():
    key = request.json.get('key')
    if not key:
        return jsonify({'error': 'No key provided'}), 400
    
    # Save to .env
    env_path = app.config['ENV_FILE']
    if not os.path.exists(env_path):
        with open(env_path, 'w') as f: f.write("")
    
    set_key(env_path, "GOOGLE_API_KEY", key)
    
    # Re-config
    success = configure_ai(key)
    if success:
        return jsonify({'message': 'API Key saved and AI activated!'})
    return jsonify({'error': 'Failed to configure AI with this key'}), 500

@app.route('/history', methods=['GET'])
@login_required
def get_history():
    conn = sqlite3.connect(app.config['DATABASE'])
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT id, filename, created_at, type FROM documents WHERE user_id = ? ORDER BY created_at DESC', (session['user_id'],))
    rows = c.fetchall()
    history = [dict(row) for row in rows]
    conn.close()
    return jsonify(history)

@app.route('/document/<int:doc_id>', methods=['GET'])
@login_required
def get_document(doc_id):
    conn = sqlite3.connect(app.config['DATABASE'])
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM documents WHERE id = ? AND user_id = ?', (doc_id, session['user_id']))
    row = c.fetchone()
    conn.close()
    if row:
        doc = dict(row)
        doc['keywords'] = json.loads(doc['keywords'])
        doc['page_insights'] = json.loads(doc['page_insights'])
        doc['stats'] = json.loads(doc['stats'])
        return jsonify(doc)
    return jsonify({'error': 'Document not found'}), 404

@app.route('/delete/<int:doc_id>', methods=['DELETE'])
@login_required
def delete_document(doc_id):
    conn = sqlite3.connect(app.config['DATABASE'])
    c = conn.cursor()
    c.execute('DELETE FROM documents WHERE id = ? AND user_id = ?', (doc_id, session['user_id']))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Deleted successfully'})

@app.route('/upload', methods=['POST'])
@login_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '' or not file.filename.endswith('.pdf'):
        return jsonify({'error': 'Invalid file'}), 400
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    file.save(filepath)
    return jsonify({'message': 'Uploaded', 'filename': file.filename})

@app.route('/analyze', methods=['POST'])
@login_required
def analyze():
    data = request.json
    filename = data.get('filename')
    input_text = data.get('text')
    is_paste_text = data.get('type') == 'text'
    full_text = ""
    page_insights = []
    if is_paste_text:
        full_text = input_text
        summary = summarize_text(full_text, 5)
        bullets = summarize_text_list(full_text, 4)
        html_insight = "<ul>" + "".join([f"<li>{b}</li>" for b in bullets]) + "</ul>"
        page_insights.append({"page": 1, "insight": html_insight})
        stats = {"pages": 1, "words": len(full_text.split()), "time": max(1, len(full_text.split()) // 200)}
    else:
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        try:
            reader = PdfReader(filepath)
            total_pages = len(reader.pages)
            for i, page in enumerate(reader.pages):
                p_text = page.extract_text()
                if p_text:
                    full_text += p_text + " "
                    if i < 15:
                        bullets = summarize_text_list(p_text, 4)
                        html_insight = "<ul>" + "".join([f"<li>{b}</li>" for b in bullets]) + "</ul>"
                        page_insights.append({"page": i + 1, "insight": html_insight})
            summary = summarize_text(full_text, 5)
            stats = {"pages": total_pages, "words": len(full_text.split()), "time": max(1, len(full_text.split()) // 200)}
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    keywords = get_keywords(full_text)
    conn = sqlite3.connect(app.config['DATABASE'])
    c = conn.cursor()
    c.execute('''INSERT INTO documents (user_id, filename, filepath, summary, keywords, page_insights, stats, type) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)''', 
              (session['user_id'], filename if not is_paste_text else "Pasted Text", "" if is_paste_text else filepath, 
               summary, json.dumps(keywords), json.dumps(page_insights), json.dumps(stats),
               'text' if is_paste_text else 'pdf'))
    doc_id = c.lastrowid
    conn.commit()
    conn.close()
    return jsonify({'id': doc_id, 'summary': summary, 'keywords': keywords, 'page_insights': page_insights, 'stats': stats})

import random
from nltk.tokenize import sent_tokenize, word_tokenize

@app.route('/generate-quiz', methods=['POST'])
@login_required
def generate_quiz():
    data = request.json
    doc_id = data.get('doc_id')
    num = data.get('count', 5)
    
    conn = sqlite3.connect(app.config['DATABASE'])
    c = conn.cursor()
    c.execute('SELECT summary, keywords FROM documents WHERE id = ? AND user_id = ?', (doc_id, session['user_id']))
    row = c.fetchone()
    conn.close()
    if not row: return jsonify({'error': 'Document not found'}), 404
    
    summary = row[0]
    
    if AI_MODEL is None:
        return jsonify({'error': 'AI is not configured. Please add an API key.'}), 400

    prompt = f"""
    Based on the following document summary, generate exactly {num} multiple-choice questions.
    Format the response as pure JSON with the following structure, without any markdown formatting or code blocks:
    [
      {{
        "question": "Question text here?",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "answer": 0 
      }}
    ]
    The 'answer' should be the 0-based index of the correct option.
    Ensure the JSON is perfectly formatted and parses correctly.
    
    Document Summary:
    {summary}
    """
    try:
        response = AI_MODEL.generate_content(prompt)
        text = response.text.strip()
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if not match:
            raise ValueError(f"Could not find JSON array in response. Text: {text[:100]}")
        text = match.group(0)
        
        questions = json.loads(text)
        formatted_questions = []
        for q in questions:
            if "question" in q and "options" in q and "answer" in q:
                formatted_questions.append(q)
                
        if not formatted_questions:
            raise ValueError("No valid questions generated")
            
        return jsonify({"questions": formatted_questions[:num]})
    except Exception as e:
        print(f"Quiz Generation Error: {e}")
        error_msg = str(e)
        if "429" in error_msg or "Quota exceeded" in error_msg:
            return jsonify({'error': 'AI Rate Limit Exceeded. Please wait a moment and try again, or check your free tier limitations.'}), 429
        return jsonify({'error': f'Failed to generate quiz using AI: {error_msg}'}), 500

@app.route('/chat', methods=['POST'])
@login_required
def chat():
    
    data = request.json
    doc_id = data.get('doc_id')
    message = data.get('message', '')
    
    conn = sqlite3.connect(app.config['DATABASE'])
    c = conn.cursor()
    c.execute('SELECT summary, page_insights FROM documents WHERE id = ? AND user_id = ?', (doc_id, session['user_id']))
    row = c.fetchone()
    conn.close()
    
    if not row:
        return jsonify({'response': "Document context not found."})
        
    summary = row[0]
    insights = json.loads(row[1]) if row[1] else []
    
    context_text = summary
    for i in insights:
        context_text += " " + i.get('insight', '')
        
    context_text = re.sub(r'<[^>]+>', ' ', context_text)
    
    if AI_MODEL is None:
        return jsonify({'response': "AI is not configured. Please add an API key."})

    prompt = f"""
    You are a helpful and intelligent AI assistant. 
    You have been provided with some context from a document. Use this context to answer the user's question accurately.
    If the answer is not explicitly in the context, use your general knowledge to answer, but politely mention that the information isn't directly from the provided document.
    Please also be forgiving of typos or misspellings in the user's question.
    IMPORTANT: Provide your response in plain text only. DO NOT use any Markdown formatting, asterisks, hashtags, or bullet points.
    
    Document Context:
    {context_text}
    
    User Question:
    {message}
    """
    
    try:
        response = AI_MODEL.generate_content(prompt)
        text = response.text.strip()
        return jsonify({'response': text})
    except Exception as e:
        print(f"Chat Error: {e}")
        error_msg = str(e)
        if "429" in error_msg or "Quota exceeded" in error_msg:
            return jsonify({'response': 'AI Rate Limit Exceeded. Please wait a moment and try again.'})
        return jsonify({'response': "Error generating response from AI."})

if __name__ == '__main__':
    app.run(debug=True)
