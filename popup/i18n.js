// 语言包
const messages = {
    zh: {
        title: '亚马逊产品提取器',
        downloadBtn: '下载',
        downloading: '正在下载...',
        productTitle: '产品标题',
        productDescription: '产品描述',
        aboutItems: '商品要点',
        productImages: '产品图片',
        noImages: '暂无图片',
        noAboutItems: '暂无商品要点信息',
        error: '无法获取产品信息。请确保您正在浏览亚马逊产品详情页面。例如：下页的页面',
        downloadError: '下载文件时出错：',
        switchToEn: 'Switch to English',
        downloadDate: '下载时间'
    },
    en: {
        title: 'Amazon Product Extractor',
        downloadBtn: 'Download',
        downloading: 'Downloading...',
        productTitle: 'Product Title',
        productDescription: 'Product Description',
        aboutItems: 'About This Item',
        productImages: 'Product Images',
        noImages: 'No Images Available',
        noAboutItems: 'No item information available',
        error: 'Unable to get product information. Please make sure you are browsing an Amazon product detail page.just like the blow',
        downloadError: 'Error downloading file: ',
        switchToZh: '切换到中文',
        downloadDate: 'Download Date'
    }
};

class I18n {
    constructor() {
        this.currentLang = localStorage.getItem('preferred_language') || 'zh';
        this._initialized = false;
    }

    // 获取翻译文本
    t(key) {
        return messages[this.currentLang][key] || key;
    }

    // 更新所有带有 data-i18n 属性的元素
    _updateElements() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.t(key);
        });
    }

    // 更新语言切换按钮
    _updateLangToggle() {
        const langToggleSpan = document.querySelector('#langToggle span');
        if (langToggleSpan) {
            langToggleSpan.textContent = this.currentLang === 'zh' ? this.t('switchToEn') : this.t('switchToZh');
        }
    }

    // 更新动态内容
    _updateDynamicContent() {
        // 更新下载按钮
        const downloadBtn = document.getElementById('downloadBtn');
        if (downloadBtn) {
            const downloadBtnText = downloadBtn.querySelector('[data-i18n="downloadBtn"]');
            if (downloadBtnText) {
                downloadBtnText.textContent = this.t('downloadBtn');
            }
        }

        // 更新无图片消息
        const noImagesMsg = document.querySelector('.no-content-message p');
        if (noImagesMsg) {
            noImagesMsg.textContent = this.t('noImages');
        }

        // 更新无商品要点消息
        const noAboutItemsMsg = document.querySelector('.about-items-list li:only-child');
        if (noAboutItemsMsg && noAboutItemsMsg.parentElement.children.length === 1) {
            noAboutItemsMsg.textContent = this.t('noAboutItems');
        }

        // 触发自定义事件，通知语言变化
        window.dispatchEvent(new CustomEvent('languageChanged', { 
            detail: { language: this.currentLang }
        }));
    }

    // 更新所有UI元素
    _updateUI() {
        this._updateElements();
        this._updateLangToggle();
        this._updateDynamicContent();
    }

    // 切换语言
    toggleLanguage() {
        this.currentLang = this.currentLang === 'zh' ? 'en' : 'zh';
        localStorage.setItem('preferred_language', this.currentLang);
        this._updateUI();
    }

    // 初始化
    init() {
        if (this._initialized) return;

        // 初始化UI
        this._updateUI();

        // 添加语言切换事件
        const langToggle = document.getElementById('langToggle');
        if (langToggle) {
            langToggle.addEventListener('click', () => this.toggleLanguage());
        }

        // 标记为已初始化
        this._initialized = true;
    }
}

// 创建实例
window.i18n = new I18n();

// 在DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.i18n.init();
});
