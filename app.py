# app.py

import sys
import subprocess

def install(package):
    """패키지가 없으면 pip로 설치"""
    subprocess.check_call([sys.executable, "-m", "pip", "install", package])

# 자동 설치 블록
try:
    import openai
except ImportError:
    print("`openai` 패키지가 없어 설치합니다...")
    install("openai")
    import openai

# 나머지 필수 모듈
from flask import Flask, request, jsonify, render_template
import json, threading, time, random
from models import Company, User

# OpenAI API 키 환경변수 확인 (없으면 안내)
import os
if "OPENAI_API_KEY" not in os.environ:
    print("경고: OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")

openai.api_key = os.getenv("OPENAI_API_KEY")

app = Flask(__name__)

# --- 회사 정보 로드 ---
companies = []
with open('data/company.json', 'r', encoding='cp1252') as f:
    data = json.load(f)
for c in data["companies"]:
    companies.append(Company(c["id"], c["name"], c["price"], c["tendency"]))

# --- 사용자 생성 ---
user = User("Player")

# --- 뉴스 & 예측 스레드 (이전과 동일) ---
news_list = []
forecast_item = None

def update_prices_loop():
    while True:
        time.sleep(5)
        for comp in companies:
            comp.update_price()

def news_forecast_loop():
    global forecast_item
    while True:
        comp = random.choice(companies)
        positive = random.random() < 0.5
        actual_effect = random.uniform(1,3) * (1 if positive else -1)

        # 예측 생성 (60% 정확도)
        if random.random() < 0.6:
            fore_eff, fore_pos = actual_effect, positive
        else:
            fore_eff, fore_pos = -actual_effect, not positive

        forecast_item = {
            "company_id": comp.id,
            "text": f"[예측] {comp.name}이(가) {'호실적' if fore_pos else '악재'} 가능성!",
            "effect": round(fore_eff,2)
        }
        time.sleep(5)

        # 실제 뉴스 반영
        comp.tendency = max(-10, min(10, comp.tendency + actual_effect))
        news_list.insert(0, {
            "company_id": comp.id,
            "text": f"{comp.name}이(가) {'호실적 발표' if positive else '규제 이슈 발생'}!",
            "effect": round(actual_effect,2)
        })
        if len(news_list) > 2:
            news_list.pop()
        forecast_item = None

# 백그라운드 스레드 시작
threading.Thread(target=update_prices_loop, daemon=True).start()
threading.Thread(target=news_forecast_loop, daemon=True).start()

# --- 라우트 정의 ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_prices')
def get_prices():
    return jsonify([c.to_dict() for c in companies])

@app.route('/get_news')
def get_news():
    return jsonify(news_list)

@app.route('/get_forecast')
def get_forecast():
    return jsonify(forecast_item or {})

@app.route('/buy', methods=['POST'])
def buy():
    data = request.get_json()
    cid, qty = int(data["company_id"]), int(data["quantity"])
    comp = next((c for c in companies if c.id == cid), None)
    if not comp:
        return jsonify(success=False, message="회사 정보 없음"), 404
    ok, cost = user.buy_stock(comp, qty)
    if ok:
        return jsonify(success=True, message=f"{comp.name} {qty}주 매수", balance=user.balance, stocks=user.stocks)
    return jsonify(success=False, message="잔액 부족", balance=user.balance), 400

@app.route('/sell', methods=['POST'])
def sell():
    data = request.get_json()
    cid, qty = int(data["company_id"]), int(data["quantity"])
    comp = next((c for c in companies if c.id == cid), None)
    if not comp:
        return jsonify(success=False, message="회사 정보 없음"), 404
    ok, rev = user.sell_stock(comp, qty)
    if ok:
        return jsonify(success=True, message=f"{comp.name} {qty}주 매도", balance=user.balance, stocks=user.stocks)
    return jsonify(success=False, message="보유 부족", balance=user.balance), 400

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    cid = int(data.get("company_id"))
    msg = data.get("message", "")
    comp = next((c for c in companies if c.id == cid), None)
    if not comp:
        return jsonify(success=False, reply="회사 정보를 찾을 수 없습니다."), 404

    system_prompt = (
        f"You are a helpful insider at {comp.name}. "
        "Answer naturally and concisely to the user's questions about the company."
    )
    try:
        resp = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": msg}
            ],
            temperature=0.7,
            max_tokens=150
        )
        reply = resp.choices[0].message.content.strip()
    except Exception:
        reply = "죄송합니다. 답변 생성 중 오류가 발생했습니다."

    return jsonify(success=True, reply=reply)

if __name__ == '__main__':
    app.run(debug=True)
