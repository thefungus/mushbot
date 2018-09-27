"use strict";
let request = require("request");

const RESIZE_URL = "http://gifgifs.com";
const UPLOAD = "/ajax/upload.php?type=save&method=resizer&source=url";
const RESIZE = "/qb.php";
const IMAGE_URL = "http://gifimgs.com";
const MAX_HEIGHT = "155";

function resizeGif(link, cb) {
    request.post(`${RESIZE_URL}${UPLOAD}`, {form: {link}}, (err, res, info) => {
        if (err) {
            return cb("errsite");
        }
        let body;
        try {
            body = JSON.parse(info);
        } catch (err) {
            return cb("errsite");
        }
        let newWidth = MAX_HEIGHT * body.width / body.height;
        let form = {
            m: "resizer",
            f: body.url,
            w: newWidth,
            h: MAX_HEIGHT
        };
        request.post(`${RESIZE_URL}${RESIZE}`, {form}, (err, res, info) => {
            if (err) {
                return cb("errsite");
            }
            let body;
            try {
                body = JSON.parse(info);
            } catch (err) {
                return cb("errsite");
            }
            let newLink = `${IMAGE_URL}/res/${body.folder}/${body.hash}.gif`;
            setTimeout(() => {
                request(`${IMAGE_URL}/img/${body.folder}/${body.hash}`, (err) => {
                    if (err) {
                        return cb("errsite");
                    }
                    return cb(null, newLink);
                });
            }, 5000);
        });
    });
}

module.exports = resizeGif;
