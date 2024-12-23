// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getProductInfo") {
        const productInfo = extractProductInfo();
        sendResponse({
            success: true,
            data: productInfo
        });
    }
    return true; // 保持消息通道开启
});

// 提取产品信息
function extractProductInfo() {
    try {
        // 提取产品标题
        const title = findElement([
            '#productTitle',
            'h1.product-title-word-break',
            '#title',
            '#item-page-title',
            '.product-title-text'
        ]);

        // 提取产品描述
        const description = findElement([
            '#productDescription',
            '#product-description',
            '.product-description',
            '#item-description',
            '.item-description'
        ]);

        // 提取About this item内容
        const aboutItems = extractAboutItems();

        // 提取所有媒体资源
        const { imageList, videos } = findAllMedia();

        return {
            title: title || '',
            description: description || '',
            aboutItems,
            media: {
                imageList,
                videos
            }
        };
    } catch (error) {
        console.error('Error extracting product info:', error);
        return {
            title: '',
            description: '',
            aboutItems: [],
            media: {
                imageList: [],
                videos: []
            }
        };
    }
}

// 辅助函数：提取About this item内容
function extractAboutItems() {
    const items = [];
    
    try {
        // 1. 尝试从feature-bullets中提取
        const featureBullets = document.querySelector('#feature-bullets');
        if (featureBullets) {
            const bulletPoints = featureBullets.querySelectorAll('li:not(.aok-hidden) span.a-list-item');
            bulletPoints.forEach(bullet => {
                const text = bullet.textContent.trim();
                if (text && !text.toLowerCase().includes('click here')) {
                    items.push(text);
                }
            });
        }

        // 2. 尝试从a-unordered-list中提取
        if (items.length === 0) {
            const unorderedList = document.querySelector('.a-unordered-list[data-feature-name="featurebullets"]');
            if (unorderedList) {
                const bulletPoints = unorderedList.querySelectorAll('li span.a-list-item');
                bulletPoints.forEach(bullet => {
                    const text = bullet.textContent.trim();
                    if (text && !text.toLowerCase().includes('click here')) {
                        items.push(text);
                    }
                });
            }
        }

        // 3. 尝试从其他可能的位置提取
        if (items.length === 0) {
            const selectors = [
                '#aboutTheProduct li',
                '.about-item-list li',
                '#feature-bullets-btf li',
                '.product-facts-list li'
            ];

            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    elements.forEach(element => {
                        const text = element.textContent.trim();
                        if (text && !text.toLowerCase().includes('click here')) {
                            items.push(text);
                        }
                    });
                    break;
                }
            }
        }

        // 4. 尝试从产品详情表格中提取
        if (items.length === 0) {
            const detailsTable = document.querySelector('#productDetails_detailBullets_sections1');
            if (detailsTable) {
                const rows = detailsTable.querySelectorAll('tr');
                rows.forEach(row => {
                    const label = row.querySelector('th');
                    const value = row.querySelector('td');
                    if (label && value) {
                        const labelText = label.textContent.trim();
                        const valueText = value.textContent.trim();
                        if (labelText && valueText) {
                            items.push(`${labelText}: ${valueText}`);
                        }
                    }
                });
            }
        }

    } catch (e) {
        console.error('Error extracting about items:', e);
    }

    return items;
}

// 辅助函数：查找文本内容
function findElement(selectors) {
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
            return element.textContent.trim();
        }
    }
    return '';
}

// 辅助函数：查找所有媒体资源
function findAllMedia() {
    const imageList = [];
    const videos = new Set();

    // 用于过滤无效图片的函数
    function isValidImageUrl(url) {
        const invalidPatterns = [
            'imageBlock-360-thumbnail-icon-small.png',
            'sprite',
            'transparent-pixel',
            'icon',
            'loading',
            'placeholder'
        ];
        return url && !invalidPatterns.some(pattern => url.toLowerCase().includes(pattern));
    }

    try {
        // 1. 处理亚马逊的图片数据结构
        if (window.ImageBlockATF && window.ImageBlockATF.data) {
            const imageData = window.ImageBlockATF.data();
            if (imageData.colorImages) {
                Object.values(imageData.colorImages).forEach(variants => {
                    variants.forEach(img => {
                        const mainUrl = img.hiRes || img.large;
                        const thumbUrl = img.thumb || img.thumbUrl || img.small;
                        if (mainUrl && isValidImageUrl(mainUrl) && isValidImageUrl(thumbUrl)) {
                            imageList.push({
                                main: mainUrl,
                                thumbnail: thumbUrl
                            });
                        }
                    });
                });
            }
        }

        // 2. 处理data-a-dynamic-image属性
        if (imageList.length === 0) {
            const mainImageElement = document.querySelector('#landingImage, #imgBlkFront');
            if (mainImageElement) {
                try {
                    const dynamicImages = JSON.parse(mainImageElement.getAttribute('data-a-dynamic-image') || '{}');
                    const urls = Object.keys(dynamicImages).filter(isValidImageUrl);
                    const mainImages = urls.filter(url => dynamicImages[url].width >= 600);
                    const thumbnails = urls.filter(url => dynamicImages[url].width < 600);
                    
                    mainImages.forEach((mainUrl, index) => {
                        imageList.push({
                            main: mainUrl,
                            thumbnail: thumbnails[index] || mainUrl
                        });
                    });
                } catch (e) {}
            }
        }

        // 3. 处理常规DOM结构
        if (imageList.length === 0) {
            const altImages = document.querySelectorAll('#altImages .a-button-thumbnail img');
            altImages.forEach(img => {
                const mainUrl = img.getAttribute('data-old-hires') || 
                              img.getAttribute('data-zoom-hires') ||
                              img.src.replace(/\._[^\.]*_\./, '.');
                const thumbUrl = img.src;
                
                if (mainUrl && isValidImageUrl(mainUrl) && isValidImageUrl(thumbUrl)) {
                    imageList.push({
                        main: mainUrl,
                        thumbnail: thumbUrl
                    });
                }
            });
        }

        // 4. 如果还是没有找到图片，尝试其他选择器
        if (imageList.length === 0) {
            const mainImage = document.querySelector('#landingImage, #imgBlkFront, #main-image');
            if (mainImage) {
                const mainUrl = mainImage.getAttribute('data-old-hires') || 
                              mainImage.getAttribute('data-zoom-hires') ||
                              mainImage.src;
                if (mainUrl && isValidImageUrl(mainUrl)) {
                    imageList.push({
                        main: mainUrl,
                        thumbnail: mainUrl
                    });
                }
            }
        }

        // 5. 提取视频信息
        // 从视频预览图获取视频信息
        document.querySelectorAll('[data-video-url]').forEach(element => {
            const videoUrl = element.getAttribute('data-video-url');
            if (videoUrl) videos.add(videoUrl);
        });

        // 处理视频播放器数据
        if (window.jQuery && jQuery('#dp-container').length > 0) {
            const videoData = jQuery('#dp-container').data('video-data');
            if (videoData && videoData.videos) {
                videoData.videos.forEach(video => {
                    if (video.url) videos.add(video.url);
                });
            }
        }

        // 查找video标签
        document.querySelectorAll('video source').forEach(source => {
            if (source.src) videos.add(source.src);
        });

        // 处理亚马逊视频数据
        if (window.kalturaPlayer) {
            const videoUrls = Object.values(window.kalturaPlayer.config.sources)
                .filter(source => source.src)
                .map(source => source.src);
            videoUrls.forEach(url => videos.add(url));
        }

    } catch (e) {
        console.error('Error extracting media:', e);
    }

    // 去重并返回结果
    return {
        imageList: Array.from(new Set(imageList.map(JSON.stringify))).map(JSON.parse),
        videos: Array.from(videos)
    };
}