class templater extends BaseCustomPlugin {
    selector = () => this.utils.getFilePath() ? undefined : this.utils.nonExistSelector
    hint = isDisable => isDisable && "空白页不可使用此插件"
    hotkey = () => [this.config.hotkey]

    callback = anchorNode => {
        if (!File.editor.selection.getRangy().collapsed) {
            ClientCommand.copyAsMarkdown();
            window.parent.navigator.clipboard.readText().then(text => this.rangeText = text);
        }

        const onchange = ev => {
            const value = ev.target.value;
            const tpl = this.config.template.find(tpl => tpl.name === value);
            if (tpl) {
                ev.target.closest(".modal-body").querySelector("textarea").value = tpl.text;
            }
        }

        const components = [
            {label: "文件名", type: "input", value: "", placeholder: "请输入新文件名，为空则创建副本"},
            {label: "模板", type: "select", list: this.config.template.map(template => template.name), onchange},
            {label: "预览", type: "textarea", rows: 10, readonly: "readonly", content: this.config.template[0].text},
        ]
        const modal = {title: "新文件", components};

        this.modal(modal, async ([{submit: filepath}, {submit: template}]) => {
            const tpl = this.config.template.find(tpl => tpl.name === template);
            if (!tpl) return;

            if (filepath && !filepath.endsWith(".md")) {
                filepath += ".md";
            }
            filepath = await this.utils.newFilePath(filepath);
            const filename = this.utils.Package.Path.basename(filepath);
            const content = (new templateHelper(filename, this))._convert(tpl.text);
            await this.utils.Package.Fs.promises.writeFile(filepath, content);
            this.rangeText = "";
            this.config.auto_open && this.utils.openFile(filepath);
        })
    }
}

class templateHelper {
    constructor(title, controller) {
        this._title = title.substring(0, title.lastIndexOf("."));
        this.rangeText = controller.rangeText || "";
        this.utils = controller.utils;
        this.config = controller.config;
        this.today = new Date();
        this.oneDay = 24 * 60 * 60 * 1000;
    }

    _getTemplateVars = () => {
        const map = {};
        this.config.template_variables.forEach(({enable, name, callback}) => {
            if (!enable) return;
            const func = eval(callback);
            if (func instanceof Function) {
                map[name] = func;
            }
        });
        Object.entries(this).forEach(([key, value]) => {
            if (value instanceof Function) {
                map[key] = value;
            }
        });
        return map
    }
    _convert = text => {
        const context = this._getTemplateVars();
        const parentheses = `\\((.*?)\\)`;
        const LBrace = `\\{\\{`;
        const RBrace = `\\}\\}`;
        const space = `\\s`;
        for (const [symbol, func] of Object.entries(context)) {
            const regExp = `${LBrace}${space}*${symbol}(${parentheses})?${space}*${RBrace}`;
            text = text.replace(new RegExp(regExp, "g"), (origin, _, templateArgs) => {
                const args = !templateArgs ? [] : eval(`[${templateArgs}]`);
                return func.apply(this, args);
            });
        }
        return text
    }
    _padStart = (str, len = 2, symbol = "0") => (str + "").padStart(len, symbol);
    _formatDate = day => `${day.getFullYear()}/${day.getMonth() + 1}/${this._padStart(day.getDate())}`;
    _formatTime = day => `${this._padStart(day.getHours())}:${this._padStart(day.getMinutes())}:${this._padStart(day.getSeconds())}`;

    uuid = () => this.utils.getUUID();
    username = () => process.env.username || this.utils.Package.OS.userInfo().username
    random = () => Math.random();
    randomInt = (floor, ceil) => this.utils.randomInt(floor, ceil);
    randomStr = () => this.utils.randomString();
    range = () => this.rangeText;
    title = () => this._title;
    folder = () => this.utils.getCurrentDirPath();
    mountFolder = () => File.getMountFolder();
    filepath = () => this.utils.Package.Path.join(this.folder(), this.title());
    weekday = () => "周" + '日一二三四五六'.charAt(this.today.getDay());
    datetime = () => this.today.toLocaleString('chinese', {hour12: false});
    date = () => this._formatDate(this.today);
    time = () => this._formatTime(this.today);
    timestamp = () => this.today.getTime();
    dateOffset = offset => this._formatDate(new Date(this.timestamp() + parseInt(offset) * this.oneDay));
    yesterday = () => this.dateOffset(-1);
    tomorrow = () => this.dateOffset(1);
}

module.exports = {
    plugin: templater,
};