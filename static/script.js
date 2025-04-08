document.addEventListener('DOMContentLoaded', () => {
  let latestPrices = {}, priceHistory = {}, companyData = [], selectedCompanies = [];
  let prevNews = [], prevForecast = null;

  // Chart.js 설정 (라인만, 채우기 없음)
  const ctx = document.getElementById('priceChart').getContext('2d');
  const priceChart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      elements: { line: { tension: 0, borderWidth: 2 }, point: { radius: 0 } },
      scales: {
        x: { display: false },
        y: {
          display: true,
          ticks: { color: '#0f0', font: { family: 'Press Start 2P' } },
          grid: { color: '#003300' }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#0f0', font: { family: 'Press Start 2P', size: 8 } }
        }
      }
    }
  });

  // 데이터 fetch
  function fetchAll() {
    fetch('/get_forecast').then(r => r.json()).then(f => {
      if (f.text && f.text !== prevForecast) showToast(f.text);
      prevForecast = f.text;
    });
    fetch('/get_news').then(r => r.json()).then(news => {
      renderNews(news);
      if (news[0]?.text !== prevNews[0]?.text) showToast(news[0].text);
      prevNews = news;
    });
    fetch('/get_prices').then(r => r.json()).then(data => {
      companyData = data;
      data.forEach(c => latestPrices[c.id] = c.price);
      renderCompanies(data);
    });
  }

  // 뉴스 렌더
  function renderNews(news) {
    const ul = document.getElementById('news-list');
    ul.innerHTML = '';
    news.forEach(item => {
      const li = document.createElement('li');
      li.innerText = item.text;
      ul.appendChild(li);
    });
  }

  // 기업 카드 렌더
  function renderCompanies(comps) {
    const ctn = document.getElementById('companies-container');
    ctn.innerHTML = '';
    comps.forEach(c => {
      if (!priceHistory[c.id]) priceHistory[c.id] = [c.price];
      else {
        priceHistory[c.id].push(c.price);
        if (priceHistory[c.id].length > 100) priceHistory[c.id].shift();
      }
      const card = document.createElement('div');
      card.className = 'company-card';
      if (selectedCompanies.includes(c.id)) card.classList.add('selected');
      card.innerHTML = `
        <h3>${c.name}</h3>
        <div class="price-info">가격: $${c.price.toFixed(2)}</div>
        <div class="quantity-selector">
          <button onclick="changeQty(${c.id}, -1)">-</button>
          <span id="qty-${c.id}">1</span>
          <button onclick="changeQty(${c.id}, 1)">+</button>
        </div>
        <div class="action-buttons">
          <button onclick="trade(${c.id}, 'buy')">매수</button>
          <button onclick="trade(${c.id}, 'sell')">매도</button>
        </div>`;
      card.onclick = e => { if (e.target.tagName !== 'BUTTON') toggleCompany(c.id); };
      ctn.appendChild(card);
    });
  }

  // 기업 토글
  window.toggleCompany = function(id) {
    const i = selectedCompanies.indexOf(id);
    if (i === -1) selectedCompanies.push(id);
    else selectedCompanies.splice(i, 1);
    renderCompanies(companyData);
    updateChart();
  };

  // 수량 조절
  window.changeQty = function(id, delta) {
    const el = document.getElementById(`qty-${id}`);
    let q = parseInt(el.innerText) + delta;
    if (q < 1) q = 1;
    el.innerText = q;
  };

  // 매수/매도
  window.trade = function(id, act) {
    const qty = parseInt(document.getElementById(`qty-${id}`).innerText);
    fetch(`/${act}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: id, quantity: qty })
    })
    .then(r => r.json())
    .then(d => {
      alert(d.message);
      updateStats(d);
      fetchAll();
    });
  };

  // 통계 업데이트
  function updateStats(d) {
    if (!d) return;
    document.getElementById('cash').innerText = `현금: $${d.balance.toFixed(2)}`;
    let tot = d.balance;
    for (let cid in d.stocks) tot += (latestPrices[cid] || 0) * d.stocks[cid];
    document.getElementById('potential').innerText = `총 자산: $${tot.toFixed(2)}`;
    let p = '포트폴리오: ';
    for (let cid in d.stocks) p += `#${cid}×${d.stocks[cid]} `;
    document.getElementById('portfolio').innerText = p || '없음';
  }

  // 차트 업데이트 (라인만, no fill)
  function updateChart() {
    priceChart.data.datasets = [];
    selectedCompanies.forEach((id, idx) => {
      const hist = priceHistory[id] || [];
      priceChart.data.labels = hist.map((_, i) => i + 1);
      const colors = ['#39FF14','#FF073A','#00FFFF','#FFAE00','#FF00FF'];
      priceChart.data.datasets.push({
        label: companyData.find(c => c.id === id).name,
        data: hist,
        borderColor: colors[idx % colors.length],
        backgroundColor: 'transparent',
        fill: false,
        tension: 0
      });
    });
    priceChart.update();
  }

  // 토스트 메시지
  function showToast(text) {
    const t = document.getElementById('toast');
    t.innerText = text;
    t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 3000);
  }

  // 스마트폰 채팅 위젯 로직
  const openBtn = document.getElementById('open-phone');
  const phone = document.getElementById('phone-widget');
  const phoneClose = document.getElementById('phone-close');
  const phoneMessages = document.getElementById('phone-messages');
  const phoneInput = document.getElementById('phone-input');
  const phoneSend = document.getElementById('phone-send');
  let currentChatCompany = null;

  openBtn.onclick = () => {
    if (!selectedCompanies.length) {
      alert('먼저 기업을 선택하세요.');
      return;
    }
    currentChatCompany = selectedCompanies[0];
    phone.style.display = 'flex';
    phoneMessages.innerHTML = '';
    appendPhoneBot(`안녕하세요! ${companyData.find(c => c.id === currentChatCompany).name} 담당자입니다. 무엇을 도와드릴까요?`);
  };
  phoneClose.onclick = () => { phone.style.display = 'none'; };

  phoneSend.onclick = () => {
    const msg = phoneInput.value.trim();
    if (!msg) return;
    appendPhoneUser(msg);
    phoneInput.value = '';
    fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ company_id: currentChatCompany, message: msg })
    })
    .then(r => r.json())
    .then(d => {
      if (d.success) appendPhoneBot(d.reply);
      else appendPhoneBot('죄송합니다, 답변을 가져올 수 없습니다.');
    });
  };

  function appendPhoneUser(text) {
    const div = document.createElement('div');
    div.className = 'phone-message user';
    div.innerText = text;
    phoneMessages.appendChild(div);
    phoneMessages.scrollTop = phoneMessages.scrollHeight;
  }
  function appendPhoneBot(text) {
    const div = document.createElement('div');
    div.className = 'phone-message bot';
    div.innerText = text;
    phoneMessages.appendChild(div);
    phoneMessages.scrollTop = phoneMessages.scrollHeight;
  }

  // 초기화 및 주기
  fetchAll();
  setInterval(() => { fetchAll(); updateChart(); }, 5000);
});
