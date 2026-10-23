// JanSetu AI Saathi (Chat Assistant Interface)

function initAssistant() {
  const triggerBtn = document.getElementById('openAssistantBtn');
  const drawer = document.getElementById('assistantDrawer');
  const closeBtn = document.getElementById('closeAssistantBtn');
  const sendBtn = document.getElementById('sendAssistantMsg');
  const input = document.getElementById('assistantInput');
  const chatMessages = document.getElementById('chatMessages');

  if (!drawer) return;

  const toggleDrawer = () => {
    drawer.classList.toggle('active');
    if (drawer.classList.contains('active')) {
      input.focus();
    }
  };

  if (triggerBtn) triggerBtn.addEventListener('click', toggleDrawer);
  if (closeBtn) closeBtn.addEventListener('click', toggleDrawer);

  const appendMessage = (sender, text) => {
    const msgDiv = document.createElement('div');
    msgDiv.style.marginBottom = '12px';
    msgDiv.style.display = 'flex';
    msgDiv.style.flexDirection = 'column';
    msgDiv.style.alignItems = sender === 'user' ? 'flex-end' : 'flex-start';

    const bubble = document.createElement('div');
    bubble.style.maxWidth = '85%';
    bubble.style.padding = '10px 14px';
    bubble.style.borderRadius = '12px';
    bubble.style.fontSize = '0.85rem';
    bubble.style.lineHeight = '1.45';

    if (sender === 'user') {
      bubble.style.backgroundColor = 'var(--primary)';
      bubble.style.color = '#ffffff';
      bubble.style.borderBottomRightRadius = '2px';
    } else {
      bubble.style.backgroundColor = '#f1f5f9';
      bubble.style.color = 'var(--text-main)';
      bubble.style.border = '1px solid #e2e8f0';
      bubble.style.borderBottomLeftRadius = '2px';
    }

    bubble.textContent = text;
    msgDiv.appendChild(bubble);

    const time = document.createElement('div');
    time.style.fontSize = '0.7rem';
    time.style.color = 'var(--text-muted)';
    time.style.marginTop = '2px';
    time.textContent = sender === 'user' ? 'You' : 'JanSetu Saathi (Demo AI)';
    msgDiv.appendChild(time);

    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  const handleSend = async (customText = null) => {
    const text = customText || (input ? input.value.trim() : '');
    if (!text) return;

    if (input) input.value = '';
    appendMessage('user', text);

    // Show typing state
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.style.fontSize = '0.75rem';
    typingDiv.style.color = 'var(--text-muted)';
    typingDiv.style.fontStyle = 'italic';
    typingDiv.textContent = 'JanSetu Saathi is thinking...';
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const lang = localStorage.getItem('jansetu_lang') || 'en';
      const res = await api.askAssistant({ message: text, lang });
      typingDiv.remove();
      appendMessage('saathi', res.reply);
    } catch (err) {
      typingDiv.remove();
      appendMessage('saathi', 'Sorry, I encountered an issue accessing the JanSetu knowledge service. Please try again.');
    }
  };

  if (sendBtn) {
    sendBtn.addEventListener('click', () => handleSend());
  }

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    });
  }

  // Handle quick prompt chips
  document.querySelectorAll('.assistant-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-query');
      if (q) handleSend(q);
    });
  });
}

document.addEventListener('DOMContentLoaded', initAssistant);
