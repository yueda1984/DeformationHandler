
function configure(packageFolder, packageName)
{
	if(about.isPaintMode())
		return;

	require("./dHandler_index.js").registerTool(packageFolder);
	var toolconfig = require("./dHandler_index.js").toolConfig;

	if (toolconfig.shortcut == true)
	{
		ScriptManager.addShortcut({
			id: toolconfig.toolId+"Shortcut",
			text: toolconfig.toolName,
			responder: "scriptResponder",
			slot: "onActionActivateToolByName(QString)",
			itemParameter: toolconfig.toolId,
			longDesc: toolconfig.description,
			order: "256",
			categoryId: "Tools",
			categoryText: "Scripts"
		});
	}

	if (toolconfig.toolbar == true)
	{
		var customToolToolbar = new ScriptToolbarDef({
			id: toolconfig.toolBarId,
			text: toolconfig.toolBarName,
			customizable: true
		});

		customToolToolbar.addButton({
			text: toolconfig.toolName,
			icon:toolconfig.icon,
			checkable: true,
			responder: "scriptResponder",
			slot: "onActionActivateToolByName(QString)",
			itemParameter: toolconfig.toolId,
			shortcut: toolconfig.slug+"Shortcut"
		});

		ScriptManager.addToolbar(customToolToolbar);
	}
}

exports.configure = configure;
