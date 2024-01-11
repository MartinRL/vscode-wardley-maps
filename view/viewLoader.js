const vscode = require('vscode');
const path = require('path');

class ViewLoader {
	constructor(context, editor, filename, onDidExportAsSvg, onDidExportAsPng) {
		this._extensionPath = context.extensionPath;
		this._editor = editor;
		this._filename = filename;
		this._onDidExportAsSvg = onDidExportAsSvg;
		this._onDidExportAsPng = onDidExportAsPng;
		this._panel = vscode.window.createWebviewPanel(
			'mapView',
			`Map View (${filename})`,
			vscode.ViewColumn.Two,
			{
				enableScripts: true,
				localResourceRoots: [
					vscode.Uri.file(path.join(this._extensionPath, 'build')),
				],
			}
		);

		this._panel.webview.html = this.getWebviewContent();
		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			(message) => {
				const textEditor = this._editor;
				switch (message.command) {
					case 'didExportAsSvg':
						console.log(
							'[[viewLoader.js::onDidReceiveMessage::didExportAsSvg',
							message
						);
						this._onDidExportAsSvg(message.val);
						break;
					case 'didExportAsPng':
						console.log(
							'[[viewLoader.js::onDidReceiveMessage::didExportAsPng',
							message
						);
						this._onDidExportAsPng(message.val);
						break;
					case 'initialLoad':
						console.log(
							'[[viewLoader.js::onDidReceiveMessage::initialLoad]]',
							textEditor.document.getText()
						);
						this.postMessage(textEditor.document.getText());
						break;
					case 'updateText':
						var firstLine = textEditor.document.lineAt(0);
						var lastLine = textEditor.document.lineAt(
							textEditor.document.lineCount - 1
						);
						var textRange = new vscode.Range(
							0,
							firstLine.range.start.character,
							textEditor.document.lineCount - 1,
							lastLine.range.end.character
						);

						// Bring the document back into focus
						vscode.window
							.showTextDocument(
								textEditor.document,
								vscode.ViewColumn.One,
								false
							)
							.then((editor) => {
								editor.edit((editBuilder) => {
									editBuilder.replace(textRange, message.val);
								});
							});
						return;
				}
			},
			undefined,
			context.subscriptions
		);
	}

	dispose = function () {
		console.log('[[viewLoader.js::dispose]]', this._filename);
		this._panel.dispose();
	};

	postMessage = function (message, command = 'text') {
		console.log('[[viewLoader.js::postMessage]]', this._filename, message);
		this._panel.webview.postMessage({ command, val: message });
	};

	setActiveEditor = function (editor) {
		this._editor = editor;
	};

	reveal = function (viewSettings) {
		this._panel.reveal(viewSettings);
	};

	getNonce = function () {
		let text = '';
		const possible =
			'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		for (let i = 0; i < 32; i++) {
			text += possible.charAt(Math.floor(Math.random() * possible.length));
		}
		return text;
	};

	buildUri = function (p) {
		const runtimePath = path.join(this._extensionPath, 'build', p);
		const runtimePathOnDisk = vscode.Uri.file(runtimePath);
		return this._panel.webview.asWebviewUri(runtimePathOnDisk);
	};

	getWebviewContent = function () {
		const csp = this._panel.webview.cspSource;
		const p = path.join(this._extensionPath, 'build', 'asset-manifest.json');
		const manifest = require(p);
		const scripts = manifest.entrypoints;
		const styles = manifest.files['main.css'];

		let scriptsToInclude = scripts.map((p) => this.buildUri(p));
		let stylesToInclude = this.buildUri(styles);
		const nonce = this.getNonce();
		let scriptText = `<link rel="stylesheet" nonce="${nonce}" href="${stylesToInclude}">\n`;

		for (let index = 0; index < scriptsToInclude.length; index++) {
			let element = scriptsToInclude[index];

			if (element.toString().endsWith('.js')) {
				scriptText += `<script nonce="${nonce}" src="${element}"></script>\n`;
			}
		}

		return `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
          <meta name="theme-color" content="#000000">
          <title>React App</title>          
		  <meta http-equiv="Content-Security-Policy" content="default-src 'self' ${csp} vscode-resource:; connect-src ${csp} 'self' vscode-resource: https:; img-src ${csp} 'self' data: vscode-resource: https:; script-src ${csp} 'nonce-${nonce}'; style-src vscode-resource: 'unsafe-inline' http: https: data:;">
          <base href="${csp}/">
        </head>
        <body>
          <div id="root"></div>
          ${scriptText}

          <script nonce="${nonce}">
            (function() {
                const vscode = acquireVsCodeApi();
                const textChangeBinding = (e) => {
					const message = e.data;
					switch (message.command) {
						case 'updateText':
							console.log("message from react", message);
							vscode.postMessage(message);
							break;
						case 'didExportAsSvg':
							console.log("message from react", message);
							vscode.postMessage(message);
							break;
						case 'didExportAsPng':
							console.log("message from react", message);
							vscode.postMessage(message);
							break;
					}
              	}
				window.addEventListener('message', (e) => textChangeBinding(e));
				window.addEventListener('load', (e) => vscode.postMessage({command:'initialLoad'}));
            }())
        </script>
        </body>
        </html>`;
	};
}

module.exports = ViewLoader;
