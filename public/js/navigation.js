document.addEventListener('DOMContentLoaded', function() {

    // Add click listeners for scroll buttons
    const scrollUpButton = document.getElementById('scroll-up-button');
    const scrollDownButton = document.getElementById('scroll-down-button');

    if (scrollUpButton) {
        scrollUpButton.addEventListener('click', function() {
            // Scroll up by 90% of the viewport height
            window.scrollBy(0, -window.innerHeight * 0.9);
        });
    }

    if (scrollDownButton) {
        scrollDownButton.addEventListener('click', function() {
            // Scroll down by 90% of the viewport height
            window.scrollBy(0, window.innerHeight * 0.9);
        });
    }
    
    // Add additional features here if needed, but keep JavaScript minimal
  });
