
(function(){
  var cfg = {"secret": "1npHi5sRQPdTfyn1tnrCLaoYbGPwNgVfaJmqMWwsUm9feVeyXF7XJQQJ99CIACYeBjFAArohAAABAZBSqrQG.9nHS0SarY2TsW3BXdp2jxyTxd0v4J3j5ycHBeMW4d0vnYwVwdFk5JQQJ99CIACYeBjFAArohAAABAZBS3KiE", "greeting": "이 스킬이 코드에서 어떻게 도면을 만드는지 물어보세요."};
  var panel = document.getElementById('qna');
  var box   = panel.querySelector('.box');
  var open  = document.getElementById('qna-open');
  var loading = false, dl = null, store = null;

  function fail(msg){ box.innerHTML = '<div class=fail>' + msg + '</div>'; }

  function v(name){
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name).trim();
  }

  // Web Chat takes plain colour values rather than css variables, so the
  // palette is read off the document at render time and the whole widget is
  // re-rendered when the theme changes. The store is kept, so re-rendering
  // does not drop the conversation.
  function styles(){
    return {
      backgroundColor: v('--bg'),
      bubbleBackground: v('--surface'),
      bubbleTextColor: v('--fg'),
      bubbleBorderColor: v('--border'),
      bubbleBorderRadius: 10,
      bubbleFromUserBackground: v('--bubble-user'),
      bubbleFromUserTextColor: v('--fg'),
      bubbleFromUserBorderColor: v('--accent-line'),
      bubbleFromUserBorderRadius: 10,
      sendBoxBackground: v('--surface'),
      sendBoxTextColor: v('--fg'),
      sendBoxBorderTop: '1px solid ' + v('--border'),
      sendBoxPlaceholderColor: v('--fg4'),
      sendBoxButtonColor: v('--accent'),
      suggestedActionBackgroundColor: v('--surface'),
      suggestedActionTextColor: v('--accent'),
      suggestedActionBorderColor: v('--accent-line'),
      suggestedActionBorderRadius: 999,
      fontSizeSmall: '12px',
      primaryFont: "'Segoe UI',system-ui,-apple-system,sans-serif",
      timestampColor: v('--fg4'),
      accent: v('--accent-line'),
      hideUploadButton: true
    };
  }

  function render(){
    var el = document.createElement('div');
    el.className = 'webchat';
    box.innerHTML = '';
    box.appendChild(el);
    window.WebChat.renderWebChat({
      directLine: dl, store: store, locale: 'ko-KR', styleOptions: styles()
    }, el);
  }

  // The Web Chat bundle is 1 MB and most visitors never open the panel, so it
  // is fetched on the first click rather than on page load.
  function boot(){
    if (loading || dl) return;
    loading = true;
    var s = document.createElement('script');
    s.src = 'https://cdn.botframework.com/botframework-webchat/latest/webchat.js';
    s.onerror = function(){
      loading = false;
      fail('채팅 스크립트를 불러오지 못했습니다. 네트워크를 확인해 주세요.');
    };
    s.onload = function(){
      try {
        dl = window.WebChat.createDirectLine({ secret: cfg.secret });
        store = window.WebChat.createStore({}, function(api){
          return function(next){ return function(action){
            if (action.type === 'DIRECT_LINE/CONNECT_FULFILLED' && cfg.greeting) {
              api.dispatch({ type:'WEB_CHAT/SEND_EVENT',
                payload:{ name:'startConversation', value:{} } });
            }
            // Copilot Studio emits trace activities that Web Chat has no
            // renderer for; letting them through throws in the render pass.
            if (action.type === 'DIRECT_LINE/INCOMING_ACTIVITY' &&
                action.payload && action.payload.activity &&
                action.payload.activity.type === 'trace') {
              return false;
            }
            return next(action);
          };};
        });
        render();
      } catch (e) {
        fail('채팅을 시작하지 못했습니다: ' + e.message);
      }
    };
    document.head.appendChild(s);
  }

  function toggle(on){
    panel.classList.toggle('on', on);
    document.body.classList.toggle('qna-on', on);
    panel.setAttribute('aria-hidden', on ? 'false' : 'true');
    if (on) boot();
  }

  open.addEventListener('click', function(){ toggle(!panel.classList.contains('on')); });
  panel.querySelector('.head button').addEventListener('click', function(){ toggle(false); });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && panel.classList.contains('on')) toggle(false);
  });
  document.addEventListener('c2f-theme', function(){ if (dl) render(); });
})();
