document.addEventListener('DOMContentLoaded', async () => {
    let currentImageIndex = 0;
    let mediaData = {
        imageList: []
    };

    // 监听语言变化事件
    window.addEventListener('languageChanged', () => {
        // 重新生成需要翻译的动态内容
        if (mediaData.imageList.length === 0) {
            showNoImagesMessage();
        }
        const aboutItemsList = document.querySelectorAll('#aboutItems li');
        if (aboutItemsList.length === 0) {
            displayAboutItems([]);
        }
    });

    // 初始化国际化
    i18n.init();

    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 向content script发送消息获取产品信息
    chrome.tabs.sendMessage(tab.id, { action: "getProductInfo" }, (response) => {
        if (response && response.success) {
            displayProductInfo(response.data);
        } else {
            showError();
        }
    });

    // 图片导航按钮事件
    document.getElementById('prevBtn').addEventListener('click', () => {
        if (currentImageIndex > 0) {
            currentImageIndex--;
            updateImageDisplay();
        }
    });

    document.getElementById('nextBtn').addEventListener('click', () => {
        if (currentImageIndex < mediaData.imageList.length - 1) {
            currentImageIndex++;
            updateImageDisplay();
        }
    });

    // 下载按钮点击事件
    document.getElementById('downloadBtn').addEventListener('click', async () => {
        try {
            const downloadBtn = document.getElementById('downloadBtn');
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = `<span class="button-icon"><i class="fas fa-spinner fa-spin"></i></span> ${i18n.t('downloading')}`;

            const productTitle = document.getElementById('productTitle').textContent;
            const productDescription = document.getElementById('productDescription').textContent;
            const aboutItemsList = Array.from(document.querySelectorAll('#aboutItems li')).map(li => li.textContent);

            console.log('开始创建ZIP文件...');
            const zip = new JSZip();

            // 创建产品信息文件夹
            const folderName = sanitizeFileName(productTitle);
            console.log('文件夹名称:', folderName);
            const productFolder = zip.folder(folderName);

            // 添加JSON文件
            const jsonData = {
                title: productTitle,
                description: productDescription,
                aboutItems: aboutItemsList,
                media: mediaData,
                downloadDate: new Date().toISOString()
            };
            productFolder.file('product_info.json', JSON.stringify(jsonData, null, 2));

            // 创建Markdown文件
            const markdownContent = generateMarkdown(jsonData);
            productFolder.file('README.md', markdownContent);

            // 创建images文件夹
            const imagesFolder = productFolder.folder('images');

            console.log('开始下载图片...');
            console.log('图片列表:', mediaData.imageList);

            // 下载所有图片
            const imagePromises = mediaData.imageList.map(async (imageData, index) => {
                try {
                    console.log(`开始下载图片 ${index + 1}:`, imageData.main);
                    
                    // 只下载主图
                    const mainImageResponse = await fetch(imageData.main, {
                        mode: 'cors',
                        credentials: 'omit'
                    });
                    
                    if (!mainImageResponse.ok) {
                        throw new Error(`Failed to fetch main image: ${mainImageResponse.status}`);
                    }
                    
                    const mainImageBlob = await mainImageResponse.blob();
                    imagesFolder.file(`image_${index + 1}.jpg`, mainImageBlob);

                    console.log(`图片 ${index + 1} 下载完成`);
                } catch (error) {
                    console.error(`下载图片 ${index + 1} 时出错:`, error);
                    throw error;
                }
            });

            await Promise.all(imagePromises);
            console.log('所有图片下载完成');

            console.log('开始生成ZIP文件...');
            const content = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: {
                    level: 9
                }
            });
            console.log('ZIP文件生成完成');

            // 使用chrome.downloads API下载文件
            const url = URL.createObjectURL(content);
            const filename = `${folderName}_product_info.zip`;
            
            console.log('开始下载ZIP文件:', filename);
            chrome.downloads.download({
                url: url,
                filename: filename,
                saveAs: true
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    console.error('下载出错:', chrome.runtime.lastError);
                    throw new Error(chrome.runtime.lastError.message);
                }
                console.log('下载已开始，下载ID:', downloadId);
                URL.revokeObjectURL(url);
            });

        } catch (error) {
            console.error('下载过程中出错:', error);
            alert(`${i18n.t('downloadError')}${error.message}`);
        } finally {
            const downloadBtn = document.getElementById('downloadBtn');
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = `<span class="button-icon"><i class="fas fa-download"></i></span> ${i18n.t('downloadBtn')}`;
        }
    });

    function generateMarkdown(data) {
        return `# ${data.title}

## ${i18n.t('productDescription')}

${data.description}

## ${i18n.t('aboutItems')}

${data.aboutItems.map(item => `- ${item}`).join('\n')}

## ${i18n.t('productImages')}

${data.media.imageList.map((_, index) => `![${i18n.t('productImages')} ${index + 1}](./images/image_${index + 1}.jpg)`).join('\n\n')}

---
${i18n.t('downloadDate')}: ${new Date(data.downloadDate).toLocaleString()}
`;
    }

    function sanitizeFileName(fileName) {
        return fileName
            .substring(0, 50) // 限制长度
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // 替换非法字符
            .trim(); // 移除首尾空格
    }

    function displayProductInfo(data) {
        document.getElementById('productTitle').textContent = data.title;
        document.getElementById('productDescription').textContent = data.description;
        
        // 显示商品要点
        displayAboutItems(data.aboutItems);
        
        // 保存媒体数据
        mediaData = {
            imageList: data.media.imageList
        };

        // 设置图片
        if (mediaData.imageList.length > 0) {
            setupImageGallery();
        } else {
            showNoImagesMessage();
        }
    }

    function displayAboutItems(items) {
        const container = document.querySelector('.about-items-list');
        container.innerHTML = '';
        
        if (items && items.length > 0) {
            items.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                container.appendChild(li);
            });
        } else {
            container.innerHTML = `<li>${i18n.t('noAboutItems')}</li>`;
        }
    }

    function setupImageGallery() {
        const container = document.getElementById('productImages');
        const thumbnailsContainer = document.getElementById('imageThumbnails');
        
        // 清空现有内容
        container.innerHTML = '';
        thumbnailsContainer.innerHTML = '';

        // 创建所有图片元素
        mediaData.imageList.forEach((imageData, index) => {
            // 创建主图片
            const img = document.createElement('img');
            img.src = imageData.main;
            img.alt = `Product image ${index + 1}`;
            img.style.display = index === 0 ? 'block' : 'none';
            container.appendChild(img);

            // 创建缩略图
            const thumb = document.createElement('img');
            thumb.src = imageData.thumbnail;
            thumb.alt = `Thumbnail ${index + 1}`;
            thumb.className = `thumbnail ${index === 0 ? 'active' : ''}`;
            thumb.addEventListener('click', () => {
                currentImageIndex = index;
                updateImageDisplay();
            });
            thumbnailsContainer.appendChild(thumb);
        });

        updateImageDisplay();
        updateImageNavigationButtons();
    }

    function updateImageDisplay() {
        // 更新计数器
        document.getElementById('imageCounter').textContent = 
            `${currentImageIndex + 1}/${mediaData.imageList.length}`;

        // 更新主图显示
        const allImages = document.querySelectorAll('#productImages img');
        allImages.forEach((img, index) => {
            img.style.display = index === currentImageIndex ? 'block' : 'none';
        });

        // 更新缩略图选中状态
        const allThumbnails = document.querySelectorAll('#imageThumbnails .thumbnail');
        allThumbnails.forEach((thumb, index) => {
            thumb.className = `thumbnail ${index === currentImageIndex ? 'active' : ''}`;
        });

        updateImageNavigationButtons();
    }

    function updateImageNavigationButtons() {
        document.getElementById('prevBtn').disabled = currentImageIndex === 0;
        document.getElementById('nextBtn').disabled = currentImageIndex === mediaData.imageList.length - 1;
    }

    function showNoImagesMessage() {
        const container = document.getElementById('productImages');
        container.innerHTML = `
            <div class="no-content-message">
                <i class="fas fa-image"></i>
                <p>${i18n.t('noImages')}</p>
            </div>
        `;
        document.getElementById('imageCounter').textContent = '0/0';
        document.getElementById('prevBtn').disabled = true;
        document.getElementById('nextBtn').disabled = true;
    }

    function showError() {
        const container = document.querySelector('.content');
        container.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>${i18n.t('error')}</p>
                <img src="../assets/imags/product_demo.png" alt="Product Demo" class="demo-image" style="max-width: 450px; height: auto; object-fit: contain;" />
            </div>
        `;
    }
});