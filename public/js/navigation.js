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

    const scrollToTopButton = document.getElementById('scroll-to-top-button');

    if (scrollToTopButton) {
        scrollToTopButton.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
            });
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
        
        // Get all post-content elements (including any that might have been added dynamically)
        const allPostContentElements = document.querySelectorAll('.post-content');
        allPostContentElements.forEach(element => {
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

    // Infinite scroll implementation
    let isLoading = false;
    let lastPostId = null;
    const scrollThreshold = 200; // Load more posts when within 200px of the bottom
    const timeline = document.querySelector('.timeline'); // Select the timeline container
    const currentView = timeline ? timeline.dataset.currentView : 'home'; // Get the current view from the timeline container
    const loadingIndicator = document.createElement('div');
    loadingIndicator.textContent = 'Loading...';
    loadingIndicator.style.textAlign = 'center';
    timeline.appendChild(loadingIndicator);
    loadingIndicator.style.display = 'none';

    function loadMorePosts() {
        if (isLoading) return;
        isLoading = true;
        loadingIndicator.style.display = 'block';

        const url = `/api/timeline/${currentView}/more?max_id=${lastPostId}`;

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to fetch more posts');
                }
                return response.json();
            })
            .then(newPosts => {
                if (newPosts.length === 0) {
                    // No more posts to load
                    window.removeEventListener('scroll', handleScroll);
                    loadingIndicator.style.display = 'none';
                    return;
                }

                newPosts.forEach(post => {
                    const article = document.createElement('article');
                    article.classList.add('post');
                    article.dataset.postId = post.id; // Set the data-post-id attribute

                    let postContent = '';
                    if (post.reblog) {
                        // This is a retoot/boost
                        postContent = `
                            <div class="post-header">
                                <strong>${post.account.display_name}</strong>
                                <span class="username">@${post.account.username}</span>
                                <span> boosted</span>
                            </div>
                            <div class="post-header">
                                <strong>${post.reblog.account.display_name}</strong>
                                <span class="username">@${post.reblog.account.username}</span>
                            </div>
                            <div class="post-content">
                                ${post.reblog.content.replace(/<[^>]*>/g, '')}
                            </div>
                            <div class="post-meta">
                                <span>${new Date(post.reblog.created_at).toLocaleString()}</span>
                            </div>
                        `;
                    } else {
                        // Regular post
                        postContent = `
                            <div class="post-header">
                                <strong>${post.account.display_name}</strong>
                                <span class="username">@${post.account.username}</span>
                            </div>
                            <div class="post-content">
                                ${post.content.replace(/<[^>]*>/g, '')}
                            </div>
                            <div class="post-meta">
                                <span>${new Date(post.created_at).toLocaleString()}</span>
                            </div>
                        `;
                    }

                    article.innerHTML = postContent;
                    timeline.appendChild(article);
                    lastPostId = post.id;
                });
            })
            .catch(error => {
                console.error('Error loading more posts:', error);
            })
            .finally(() => {
                isLoading = false;
                loadingIndicator.style.display = 'none';
            });
    }

    function handleScroll() {
        if (isLoading) return;

        const documentHeight = document.documentElement.scrollHeight;
        const windowHeight = window.innerHeight;
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const scrollPosition = windowHeight + scrollTop;

        if (documentHeight - scrollPosition <= scrollThreshold) {
            loadMorePosts();
        }
    }

    // Get initial lastPostId
    const initialPosts = document.querySelectorAll('.post');
    if (initialPosts.length > 0) {
        lastPostId = initialPosts[initialPosts.length - 1].dataset.postId;
    }

    window.addEventListener('scroll', handleScroll);
    
    // Add additional features here if needed, but keep JavaScript minimal
  });
