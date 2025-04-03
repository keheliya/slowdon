document.addEventListener('DOMContentLoaded', function() {
    // Add keyboard navigation support
    document.addEventListener('keydown', function(e) {
      // Page Up key
      if (e.key === 'PageUp') {
        const prevButton = document.querySelector('.navigation-controls a:first-child');
        if (prevButton && !prevButton.classList.contains('disabled')) {
          window.location.href = prevButton.getAttribute('href');
        }
      }
      
      // Page Down key
      if (e.key === 'PageDown') {
        const nextButton = document.querySelector('.navigation-controls a:last-child');
        if (nextButton && !nextButton.classList.contains('disabled')) {
          window.location.href = nextButton.getAttribute('href');
        }
      }
    });
    
    // Add additional features here if needed, but keep JavaScript minimal
  });