
(function(){
  var cfg = {"secret": "1npHi5sRQPdTfyn1tnrCLaoYbGPwNgVfaJmqMWwsUm9feVeyXF7XJQQJ99CIACYeBjFAArohAAABAZBSqrQG.9nHS0SarY2TsW3BXdp2jxyTxd0v4J3j5ycHBeMW4d0vnYwVwdFk5JQQJ99CIACYeBjFAArohAAABAZBS3KiE", "greeting": "이 스킬이 코드에서 어떻게 도면을 만드는지 물어보세요."};
  var panel = document.getElementById('qna');
  var box   = panel.querySelector('.box');
  var open  = document.getElementById('qna-open');
  var ready = false;

  function fail(msg){
    box.innerHTML = '<div class=fail>' + msg + '</div>';
  }

  // The Web Chat bundle is 1 MB and most visitors never open the panel, so it
  // is fetched on the first click rather than on page load.
  function boot(){
    if (ready) return;
    ready = true;
    var s = document.createElement('script');
    s.src = 'https://cdn.botframework.com/botframework-webchat/latest/webchat.js';
    s.onerror = function(){ ready = false; fail('채팅 스크립트를 불러오지 못했습니다. 네트워크를 확인해 주세요.'); };
    s.onload = function(){
      try {
        var d = window.WebChat.createDirectLine({ secret: cfg.secret });
        var store = window.WebChat.createStore({}, function(api){
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
        var el = document.createElement('div');
        el.className = 'webchat';
        box.innerHTML = '';
        box.appendChild(el);
        window.WebChat.renderWebChat({
          directLine: d,
          store: store,
          locale: 'ko-KR',
          styleOptions: {
            backgroundColor: '#12161c',
            bubbleBackground: '#1b212b',
            bubbleTextColor: '#d5dae2',
            bubbleBorderColor: '#252b36',
            bubbleBorderRadius: 10,
            bubbleFromUserBackground: '#1d3a63',
            bubbleFromUserTextColor: '#dce6f5',
            bubbleFromUserBorderColor: '#2f5d99',
            bubbleFromUserBorderRadius: 10,
            sendBoxBackground: '#161a21',
            sendBoxTextColor: '#e6e9ee',
            sendBoxBorderTop: '1px solid #232833',
            sendBoxPlaceholderColor: '#6b7583',
            sendBoxButtonColor: '#7aa7e8',
            suggestedActionBackgroundColor: '#161a21',
            suggestedActionTextColor: '#9fc0ee',
            suggestedActionBorderColor: '#2f5d99',
            suggestedActionBorderRadius: 999,
            fontSizeSmall: '12px',
            primaryFont: "'Segoe UI',system-ui,-apple-system,sans-serif",
            timestampColor: '#6b7583',
            accent: '#3d6fb5',
            hideUploadButton: true
          }
        }, el);
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
})();
