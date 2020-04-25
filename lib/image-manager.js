/**
 * Created by jojoldu@gmail.com on 2017-01-07
 * Blog : http://jojoldu.tistory.com
 * Github : http://github.com/jojoldu
 */

const fs = require('fs-extra');
const path = require('path');
const rp = require('request-promise');
const print = require('./print');

const LOCAL_IMAGE_REGEX = new RegExp("^(http|https)://", "i");
const MARKDOWN_IMAGE_REGEX = /(?:!\[(.*?)\]\((.*?)\))/g;
const TISTORY_API_URL = 'https://www.tistory.com/apis/post/attach';

exports.exchange = async (markdownPath, markdownText, params) => {
    const originImagePaths = getImages(markdownText);
    const imageUrls = await requestImageUrl(originImagePaths, markdownPath, params);
    return exchangePathToUrl(markdownText, imageUrls);
};

const getImages = (markdownText) => {
    return markdownText.match(MARKDOWN_IMAGE_REGEX) || [];
};

const exchangePathToUrl = (markdownText, replaces) => {
    let markdownData = markdownText;
    for (let i = 0, length = replaces.length; i < length; i++) {
        if (markdownData) {
            markdownData = markdownData.replace(replaces[i].localPath, replaces[i].tistoryUrl);
        }
    }
    return markdownData;
};

async function requestImageUrl(images, markdownPath, params) {
    return Promise.all(images.map(async (markdownImage) => {
        const imagePath = extractPath(markdownImage);

        if (isNotLocalImage(imagePath)) {
            print.gray('This is External Path (ex: http://, https://');
            return false;
        } else {
            const realPath = exchangeRealPath(imagePath, markdownPath);
            const isExist = await fs.exists(realPath);
            if (!isExist) {
                print.gray('Not Found File: ' + realPath);
                return false;
            }

            const formData = {
                "access_token": params.accessToken,
                "blogName": params.blogName,
                "targetUrl": params.targetUrl,
                "uploadedfile": await fs.createReadStream(realPath),
                "output": "json"
            };
            try {
                const response = await rp.post({url: TISTORY_API_URL, formData: formData});
                const tistory = JSON.parse(response).tistory;

                if (tistory.status === '200') {
                    return {localPath: imagePath, tistoryUrl: tistory.url};
                } else {
                    print.red('code: ' + tistory.status + ' message: ' + tistory['error_message']);
                    return false;
                }
            } catch (err) {
                throw err;
            }

        }
    }));
}

const exchangeRealPath = (imagePath, markdownPath) => {
    const isRelativePath = imagePath.startsWith('\.');

    if (isRelativePath) {
        const removedPath = removeFileName(markdownPath);
        return path.join(removedPath + imagePath)
    }
    return imagePath;
};

const removeFileName = (markdownPath) => {
    const parsed = markdownPath.split("\/");
    parsed.splice(parsed.length - 1, 1); // 마지막 위치의 파일명 삭제

    if (parsed.length === 0) {
        parsed.push('.');
    }

    return parsed.join('/') + '/';
};

const isNotLocalImage = (image) => {
    return LOCAL_IMAGE_REGEX.test(image);
};

const extractPath = (markdownImage) => {
    return markdownImage.split('(')[1].replace(')', '');
};

exports.exchangeRealPath = exchangeRealPath;
exports.removeFileName = removeFileName;
exports.getImages = getImages;