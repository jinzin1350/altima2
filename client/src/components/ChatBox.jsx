import { useState, useEffect, useRef } from 'react';

function ChatBox() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);

  // Fetch suggested questions
  useEffect(() => {
    fetch('/api/chat/suggestions')
      .then(res => res.json())
      .then(data => setSuggestions(data.suggestions || []))
      .catch(err => console.error('Error fetching suggestions:', err));
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (messageText) => {
    if (!messageText.trim()) return;

    const userMessage = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      });

      const data = await response.json();

      const aiMessage = {
        role: 'assistant',
        content: data.reply,
        type: data.type,
        metadata: data.metadata,
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your request.',
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickQuestion = (question) => {
    sendMessage(question);
  };

  return (
    <div className="chatbox-fullscreen">
      <div className="chatbox-welcome">
        <h2 className="chatbox-title">Ask me anything about your network alerts</h2>
        <p className="chatbox-subtitle">I can analyze patterns, answer questions, and provide insights</p>
      </div>

      {/* Quick Questions */}
      {messages.length === 0 && (
        <div className="quick-questions-grid"

>
          <h3 className="quick-questions-title">Quick Questions</h3>
          {suggestions.map((category, idx) => (
            <div key={idx} className="question-category">
              <h4 className="category-title">{category.category}</h4>
              <div className="question-buttons">
                {category.questions?.map((question, qIdx) => (
                  <button
                    key={qIdx}
                    className="quick-question-btn"
                    onClick={() => handleQuickQuestion(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            <div className="message-header">
              <span className="message-role">
                {message.role === 'user' ? '👤 You' : '🤖 AI Assistant'}
              </span>
              {message.type && (
                <span className={`message-type ${message.type}`}>
                  {message.type === 'sql' ? '📊 SQL' : '🔍 RAG'}
                </span>
              )}
            </div>
            <div className="message-content">{message.content}</div>
            {message.metadata?.sources && message.metadata.sources.length > 0 && (
              <div className="message-sources">
                <details>
                  <summary>
                    📎 {message.metadata.sources.length} source(s)
                  </summary>
                  <div className="sources-list">
                    {message.metadata.sources.slice(0, 3).map((source, idx) => (
                      <div key={idx} className="source-item">
                        <div className="source-header">
                          <strong>{source.host}</strong>
                          <span className="source-similarity">
                            {(source.similarity * 100).toFixed(0)}% match
                          </span>
                        </div>
                        <div className="source-details">
                          {source.description?.substring(0, 100)}...
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="message assistant">
            <div className="message-header">
              <span className="message-role">🤖 AI Assistant</span>
            </div>
            <div className="message-content loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat-input"
          placeholder="Ask a question about your network alerts..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatBox;
