// Outlook Add-in JavaScript Functions

Office.initialize = function () {
  console.log('Outlook add-in initialized');
};

// Yeni sekmede uygulamayı aç
function openFullApp(event) {
  // Yeni tarayıcı sekmesinde aç
  window.open('https://www.dovec.app/dashboard/requests', '_blank');
  
  // Event'i tamamla
  if (event) {
    event.completed();
  }
}

// Global namespace'e kaydet
if (typeof window !== 'undefined') {
  window.openFullApp = openFullApp;
}
