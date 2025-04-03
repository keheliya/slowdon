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

    // Font size adjustment
    const fontIncreaseButton = document.getElementById('font-increase');
    const fontDecreaseButton = document.getElementById('font-decrease');
    const bodyElement = document.body;
    const minFontSize = 0.8; // Minimum font size in rem
    const maxFontSize = 2.5; // Maximum font size in rem
    const fontSizeStep = 0.1; // Font size step in rem

    // Store the initial font size ratio between body and post-content
    const bodyInitialSize = parseFloat(window.getComputedStyle(bodyElement).fontSize);
    const postContentElements = document.querySelectorAll('.post-content');
    let postContentRatio = 1.2; // Default from CSS
    
    if (postContentElements.length > 0) {
        const postContentInitialSize = parseFloat(window.getComputedStyle(postContentElements[0]).fontSize);
        postContentRatio = postContentInitialSize / bodyInitialSize;
    }

    function getCurrentFontSizeRem() {
        const currentSize = window.getComputedStyle(bodyElement).fontSize;
        // Need to convert px to rem if necessary, assuming 1rem = 16px (browser default)
        let size = parseFloat(currentSize);
        if (currentSize.includes('px')) {
            // Rough conversion assuming 1rem = 16px (might not be perfect)
            const rootFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize);
            size = size / rootFontSize;
        }
        // Fallback if parsing fails
        return isNaN(size) ? 1.1 : size; 
    }

    function updateAllFontSizes(newBodySizeRem) {
        // Update body font size
        bodyElement.style.fontSize = newBodySizeRem + 'rem';
        
        // Update post-content font size to maintain the ratio
        const newPostContentSize = newBodySizeRem * postContentRatio;
        postContentElements.forEach(element => {
            element.style.fontSize = newPostContentSize + 'rem';
        });
    }

    if (fontIncreaseButton) {
        fontIncreaseButton.addEventListener('click', function() {
            let currentSizeRem = getCurrentFontSizeRem();
            let newSizeRem = Math.min(maxFontSize, currentSizeRem + fontSizeStep);
            updateAllFontSizes(newSizeRem);
        });
    }

    if (fontDecreaseButton) {
        fontDecreaseButton.addEventListener('click', function() {
            let currentSizeRem = getCurrentFontSizeRem();
            let newSizeRem = Math.max(minFontSize, currentSizeRem - fontSizeStep);
            updateAllFontSizes(newSizeRem);
        });
    }
    
    // Add additional features here if needed, but keep JavaScript minimal
  });
