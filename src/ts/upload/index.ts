import {getEditorRange, setSelectionFocus} from "../util/selection";
import {getElement} from "./getElement";
import {setHeaders} from "./setHeaders";

class Upload {
    public element: HTMLElement;
    public isUploading: boolean;
    public range: Range;

    constructor() {
        this.isUploading = false;
        this.element = document.createElement("div");
        this.element.className = "vditor-upload";
    }
}

const validateFile = (vditor: IVditor, files: File[]) => {
    vditor.tip.hide();
    const uploadFileList = [];
    let errorTip = "";
    let uploadingStr = "";
    const lang: keyof II18n | "" = vditor.options.lang;
    const options: IOptions = vditor.options;

    for (let iMax = files.length, i = 0; i < iMax; i++) {
        const file = files[i];
        let validate = true;

        if (!file.name) {
            errorTip += `<li>${window.VditorI18n.nameEmpty}</li>`;
            validate = false;
        }

        if (file.size > vditor.options.upload.max) {
            errorTip += `<li>${file.name} ${window.VditorI18n.over} ${vditor.options.upload.max / 1024 / 1024}M</li>`;
            validate = false;
        }

        const lastIndex = file.name.lastIndexOf(".");
        const fileExt = file.name.substr(lastIndex);
        const filename = vditor.options.upload.filename(file.name.substr(0, lastIndex)) + fileExt;

        if (vditor.options.upload.accept) {
            const isAccept = vditor.options.upload.accept.split(",").some((item) => {
                const type = item.trim();
                if (type.indexOf(".") === 0) {
                    if (fileExt.toLowerCase() === type.toLowerCase()) {
                        return true;
                    }
                } else {
                    if (file.type.split("/")[0] === type.split("/")[0]) {
                        return true;
                    }
                }
                return false;
            });

            if (!isAccept) {
                errorTip += `<li>${file.name} ${window.VditorI18n.fileTypeError}</li>`;
                validate = false;
            }
        }

        if (validate) {
            uploadFileList.push(file);
            uploadingStr += `<li>${filename} ${window.VditorI18n.uploading}</li>`;
        }
    }

    vditor.tip.show(`<ul>${errorTip}${uploadingStr}</ul>`);

    return uploadFileList;
};

const genUploadedLabel = (response: unknown, vditor: IVditor) => {
    const editorElement = getElement(vditor);
    editorElement.focus();

    (vditor.options.upload.customUploaderCompleted || defaultUploaderCompleted)(response, vditor, (html?: string) => {
        if (html) {
            vditor.tip.show(html);
        } else {
            vditor.tip.hide();
        }
    })
};

const defaultUploaderCompleted = (responseText: unknown, vditor: IVditor, errorCallback: (html?: string) => void) => {
    const response = JSON.parse(responseText as string);
    let errorTip = "";

    if (response.code === 1) {
        errorTip = `${response.msg}`;
    }

    if (response.data.errFiles && response.data.errFiles.length > 0) {
        errorTip = `<ul><li>${errorTip}</li>`;
        response.data.errFiles.forEach((data: string) => {
            const lastIndex = data.lastIndexOf(".");
            const filename = vditor.options.upload.filename(data.substr(0, lastIndex)) + data.substr(lastIndex);
            errorTip += `<li>${filename} ${window.VditorI18n.uploadError}</li>`;
        });
        errorTip += "</ul>";
    }

    errorCallback(errorTip);

    let succFileText = "";
    Object.keys(response.data.succMap).forEach((key) => {
        const path = response.data.succMap[key];
        const lastIndex = key.lastIndexOf(".");
        let type = key.substr(lastIndex);
        const filename = vditor.options.upload.filename(key.substr(0, lastIndex)) + type;
        type = type.toLowerCase();
        if (type.indexOf(".wav") === 0 || type.indexOf(".mp3") === 0 || type.indexOf(".ogg") === 0) {
            if (vditor.currentMode === "wysiwyg") {
                succFileText += `<div class="vditor-wysiwyg__block" data-type="html-block"
 data-block="0"><pre><code>&lt;audio controls="controls" src="${path}"&gt;&lt;/audio&gt;</code></pre><pre class="vditor-wysiwyg__preview" data-render="1"><audio controls="controls" src="${path}"></audio></pre></div>\n`;
            } else if (vditor.currentMode === "ir") {
                succFileText += `<audio controls="controls" src="${path}"></audio>\n`;
            } else {
                succFileText += `[${filename}](${path})\n`;
            }
        } else if (type.indexOf(".apng") === 0
            || type.indexOf(".bmp") === 0
            || type.indexOf(".gif") === 0
            || type.indexOf(".ico") === 0 || type.indexOf(".cur") === 0
            || type.indexOf(".jpg") === 0 || type.indexOf(".jpeg") === 0 || type.indexOf(".jfif") === 0 || type.indexOf(".pjp") === 0 || type.indexOf(".pjpeg") === 0
            || type.indexOf(".png") === 0
            || type.indexOf(".svg") === 0
            || type.indexOf(".webp") === 0) {
            if (vditor.currentMode === "wysiwyg") {
                succFileText += `<img alt="${filename}" src="${path}">\n`;
            } else {
                succFileText += `![${filename}](${path})\n`;
            }
        } else {
            if (vditor.currentMode === "wysiwyg") {
                succFileText += `<a href="${path}">${filename}</a>\n`;
            } else {
                succFileText += `[${filename}](${path})\n`;
            }
        }
    });
    setSelectionFocus(vditor.upload.range);
    document.execCommand("insertHTML", false, succFileText);
    vditor.upload.range = getSelection().getRangeAt(0).cloneRange();
}

const uploadFiles =
    async (vditor: IVditor, files: FileList | DataTransferItemList | File[], element?: HTMLInputElement) => {
        // FileList | DataTransferItemList | File[] => File[]
        let fileList = [];
        const filesMax = vditor.options.upload.multiple === true ? files.length : 1;
        for (let i = 0; i < filesMax; i++) {
            let fileItem = files[i];
            if (fileItem instanceof DataTransferItem) {
                fileItem = fileItem.getAsFile();
            }
            fileList.push(fileItem);
        }

        if (vditor.options.upload.handler) {
            const isValidate = await vditor.options.upload.handler(fileList);
            if (element) {
                element.value = "";
            }
            if (typeof isValidate === "string") {
                vditor.tip.show(isValidate);
                return;
            }
            return;
        }

        if (!vditor.options.upload.url || !vditor.upload) {
            if (element) {
                element.value = "";
            }
            vditor.tip.show("please config: options.upload.url");
            return;
        }

        if (vditor.options.upload.file) {
            fileList = await vditor.options.upload.file(fileList);
        }

        if (vditor.options.upload.validate) {
            const isValidate = vditor.options.upload.validate(fileList);
            if (typeof isValidate === "string") {
                vditor.tip.show(isValidate);
                return;
            }
        }
        const editorElement = getElement(vditor);

        vditor.upload.range = getEditorRange(vditor);

        const validateResult = validateFile(vditor, fileList);
        if (validateResult.length === 0) {
            if (element) {
                element.value = "";
            }
            return;
        }

        editorElement.setAttribute("contenteditable", "false");

        (vditor.options.upload.customUploader || defaultUploader)(validateResult, vditor, (progress: number) => {
            vditor.upload.element.style.display = "block";
            const progressBar = vditor.upload.element;
            progressBar.style.width = (progress * 100) + "%";
        }).then((response: unknown) => {
            // genUploadedLabel requires contenteditable.
            editorElement.setAttribute("contenteditable", "true");

            if (vditor.options.upload.success) {
                vditor.options.upload.success(editorElement, response as string);
            } else {
                if (vditor.options.upload.format) {
                    response = vditor.options.upload.format(files as File [], response as string);
                }
                genUploadedLabel(response, vditor);
            }
        }).catch((message: string) => {
            // Restore contenteditable on error.
            editorElement.setAttribute("contenteditable", "true");

            if (vditor.options.upload.error) {
                vditor.options.upload.error(message);
            } else {
                vditor.tip.show(message);
            }
        }).finally(() => {
            vditor.upload.isUploading = false;
            if (element) {
                element.value = "";
            }
            vditor.upload.element.style.display = "none";
        })
    };

const defaultUploader = (files: File[], vditor: IVditor, onProgress: (progress: number) => void) => new Promise((resolve, reject) => {
    const formData = new FormData();

    const extraData = vditor.options.upload.extraData;
    for (const key of Object.keys(extraData)) {
        formData.append(key, extraData[key]);
    }

    for (let i = 0, iMax = files.length; i < iMax; i++) {
        formData.append(vditor.options.upload.fieldName, files[i]);
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", vditor.options.upload.url);
    if (vditor.options.upload.token) {
        xhr.setRequestHeader("X-Upload-Token", vditor.options.upload.token);
    }
    if (vditor.options.upload.withCredentials) {
        xhr.withCredentials = true;
    }
    setHeaders(vditor, xhr);
    vditor.upload.isUploading = true;
    xhr.onreadystatechange = () => {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.responseText);
            } else {
                reject(xhr.responseText);
            }
        }
    };
    xhr.upload.onprogress = (event: ProgressEvent) => {
        if (!event.lengthComputable) {
            return;
        }
        onProgress(event.loaded / event.total);
    };
    xhr.send(formData);
})

export {Upload, uploadFiles};
