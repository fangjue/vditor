import {code160to32} from "../util/code160to32";

const runHook = (vditor: IVditor, el: HTMLElement): string | undefined => {
    if (vditor.options.beforeGetMarkdown) {
        return vditor.options.beforeGetMarkdown(vditor.currentMode, el)
    }
}

export const getMarkdown = (vditor: IVditor) => {
    if (vditor.currentMode === "sv") {
        return code160to32(`${vditor.sv.element.textContent}\n`.replace(/\n\n$/, "\n"));
    } else {
        if (vditor.currentMode === "wysiwyg") {
            const el = vditor.wysiwyg.element
            return vditor.lute.VditorDOM2Md(runHook(vditor, el) || el.innerHTML);
        } else if (vditor.currentMode === "ir") {
            const el = vditor.ir.element
            return vditor.lute.VditorIRDOM2Md(runHook(vditor, el) || el.innerHTML);
        }
    }
    return "";
};
