async function getImagesFromUrl(url) {
    try {
        // const response = await fetch("https://proxy.corsfix.com/?" + url);        
        const response = await fetch(url);        
        const html = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const images = doc.getElementsByTagName('img');
        
        const imageList = [];
        for (let img of images) {
            imageList.push({
                src: img.src,
                alt: img.alt || 'none',
            });
        }
        
        return imageList;
        
    } catch (error) {
        console.error(`Get images from ${url} error:`, error);
        return [];
    }
}

async function getLinksFromUrl(url) {
    try {
        // const response = await fetch("https://proxy.corsfix.com/?" + url);        
        const response = await fetch(url);        
        const html = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const links = doc.getElementsByTagName('a');
        
        const imageList = [];
        for (let a of links) {
            imageList.push({
                src: a.href,
                text: a.textContent || a.getAttribute('aria-label') || 'none',
                title: a.title || 'none'
            });
        }
        
        return imageList;
        
    } catch (error) {
        console.error(`Get links from ${url} error:`, error);
        return [];
    }
}

async function showImages() {
    let url;
    url = document.getElementById('urlInput').value;
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    try {
        const images = await getImagesFromUrl(url);
        
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = '';
        
        if (images.length === 0) {
            resultsDiv.innerHTML = '<p>هیچ تصویری در این صفحه یافت نشد</p>';
            return;
        }
        
        images.forEach((img, index) => {

            resultsDiv.innerHTML += `
            <p>${JSON.stringify(img)}</p>
                <img src="${img.src}" alt="${img.alt}" style="max-width: 200px; max-height: 200px; margin: 10px 0;">
            `;
        });
        
    } catch (error) {
        console.error('خطا:', error);
        alert('خطا در پردازش درخواست');
    }
}

async function showLinks() {
    let url;
    url = document.getElementById('urlInput').value;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    try {
        const links = await getLinksFromUrl(url);
        
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = '';
        
        if (links.length === 0) {
            resultsDiv.innerHTML = '<p>هیچ لینکی در این صفحه یافت نشد</p>';
            return;
        }
        
        links.forEach((link, index) => {
            resultsDiv.innerHTML += `
                <p><a href="${link.src}" target="_blank">${link.text}</a> - ${link.title}</p>
            `;
        });
        
    } catch (error) {
        console.error('خطا:', error);
        alert('خطا در پردازش درخواست');
    }
}