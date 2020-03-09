const sketch = require('sketch')
const UI = require('sketch/ui')

const fileManager = NSFileManager.defaultManager()
const supportedImages = NSArray.arrayWithArray(["png", "jpg", "jpeg"])
var outputFolder = ""

export default function(context) {
	const documentURL = context.document.fileURL()
	const folderURL = documentURL.URLByDeletingLastPathComponent()
	const manifestURL = folderURL.URLByAppendingPathComponent("screenshots.manifest.json")
	if (fileManager.fileExistsAtPath(manifestURL.path())) {
		readManifest(manifestURL)
	} else {
		askForManifestFile()
	}
}

function jsonFromFile(filePath) {
	const data = NSData.dataWithContentsOfFile(filePath)
	return NSJSONSerialization.JSONObjectWithData_options_error(data, 0, nil)
}

function processLanguage(language, url) {	
	// strings
	if (language["strings"] != undefined) {
		const stringsFile = url.URLByAppendingPathComponent(language["strings"])
		if (!fileManager.fileExistsAtPath(stringsFile.path())) {
			UI.message("⚠️ Language file not found!")
			return
		}
		processTexts(stringsFile)
	}

	// screenshots
	if (language["screenshots"] != undefined) {
		const imageFolder = url.URLByAppendingPathComponent(language["screenshots"])
		processImages(imageFolder)
	}

	// images
	if (language["images"] != undefined) {
		const imageFolder = url.URLByAppendingPathComponent(language["images"])
		processImages(imageFolder)
	}

	exportArtboards(language, url)
}

function processTexts(file) {
	const strings = jsonFromFile(file)
	const keys = strings.allKeys()
	keys.forEach(key => {
    	replaceText(key, strings[key])
  	})
}

function processImages(folder) {
	const contents = fileManager.contentsOfDirectoryAtPath_error(folder.path(), nil)
	contents.forEach(file => {
		const fileName = file.lastPathComponent()
    	const pathExtension = fileName.pathExtension()
    
    	if(supportedImages.containsObject(pathExtension)) {
      		const imageURL = folder.URLByAppendingPathComponent(file)
      		replaceImage(fileName.stringByDeletingPathExtension(), imageURL)
    	}
	})
}

function replaceImage(key, url) {
  const selector = '[name="[' + key + ']"]'
  const imageLayers = sketch.find(selector)
  imageLayers.forEach(layer => {
  	if (layer.type == 'Image' && layer.image != undefined) {
		const srcImage = NSImage.alloc().initByReferencingFile(url.path())
		layer.image = srcImage
  	} else if (layer.overrides != undefined) {
  		layer.overrides.forEach(override => {
			if (override.property !== 'image') {
			  return
			}

			const srcImage = NSImage.alloc().initByReferencingFile(url.path())
			override.value = srcImage
		})
  	}
  })  
}

function exportArtboards(language) {
	const outputs = language["output"]
	const exportFolder = outputFolder.URLByAppendingPathComponent(outputs[0])
  	const pages = sketch.getSelectedDocument().pages
  	pages.forEach(page => {
  		if (page.isSymbolsPage()) {
  			return
  		}

	  	const layers = page.layers
	  	layers.forEach(layer => {
	  		// only export layers with exportFormat assigned
	  		if (layer.exportFormats.length <= 0) {
	  			return
	  		}
		  	const options = { formats: 'png', output: exportFolder.path(), overwriting: true }
		  	sketch.export(layer, options)
		})
  	})

  	if (outputs.length > 1) {
  		copyOutputFolder(outputs)
  	}

  	UI.message("All done! 🚀")
}

function cleanOutputFolder() {
	fileManager.removeItemAtPath_error(outputFolder.path(), nil)
}

function copyOutputFolder(outputs) {
	const sourceURL = outputFolder.URLByAppendingPathComponent(outputs[0])

	outputs.forEach((output, index) => {
		if (index == 0) {
			return
		}
		const destinationURL = outputFolder.URLByAppendingPathComponent(output)
		fileManager.copyItemAtURL_toURL_error(sourceURL, destinationURL, nil)
	})
}

function replaceText(key, text) {
  const selector = 'Text, [name="[' + key + ']"]'
  const textLayers = sketch.find(selector)
  textLayers.forEach(layer => {
      layer.text = text
  })
}

function readManifest(url) {
	const json = jsonFromFile(url)
	const baseURL = url.URLByDeletingLastPathComponent()

	if (json["output"] == undefined) {
		UI.message("⚠️ No output folder defined")
		return
	}

	outputFolder = baseURL.URLByAppendingPathComponent(json["output"])
	cleanOutputFolder()

	// process languages
	if (json["languages"] == undefined || json["languages"].length <= 0) {
		UI.message("⚠️ No languages defined")
		return
	}

	const languages = json["languages"]
	languages.forEach(language => {
    	processLanguage(language, baseURL)
  	})
}

function askForManifestFile() {
	const openDialog = NSOpenPanel.openPanel()
	openDialog.setCanChooseFiles(true)
	openDialog.setAllowedFileTypes(["json"])
	openDialog.setCanChooseDirectories(false)
	openDialog.setAllowsMultipleSelection(false)
	openDialog.setCanCreateDirectories(false)
	openDialog.setTitle("Select the Screenshots manifest file")
	if( openDialog.runModal() == NSOKButton ) {
		readManifest(openDialog.URL())
	}
}
