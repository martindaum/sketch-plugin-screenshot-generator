var sketch = require('sketch')
var UI = require('sketch/ui')

var fileManager = NSFileManager.defaultManager()
var supportedImages = NSArray.arrayWithArray(["png", "jpg", "jpeg"])
var outputFolder = ""

function jsonFromFile(filePath) {
	var data = NSData.dataWithContentsOfFile(filePath)
	return NSJSONSerialization.JSONObjectWithData_options_error(data, 0, nil)
}

function processLanguage(language, url) {
	// strings
	var stringsFile = url.URLByAppendingPathComponent(language["strings"])
	var strings = jsonFromFile(stringsFile)
	var keys = strings.allKeys()
	keys.forEach(key => {
    	replaceText(key, strings[key])
  	})

	// images
	var imageFolder = url.URLByAppendingPathComponent(language["screenshots"])
	var contents = fileManager.contentsOfDirectoryAtPath_error(imageFolder.path(), nil)
	contents.forEach(file => {
		var fileName = file.lastPathComponent()
    	var pathExtension = fileName.pathExtension()
    
    	if(supportedImages.containsObject(pathExtension)) {
      		var imageURL = imageFolder.URLByAppendingPathComponent(file)
      		replaceImage(fileName.stringByDeletingPathExtension(), imageURL)
    	}
	})

	exportArtboards(language, url)
}

function replaceImage(key, url) {
  var selector = '[name="{{{' + key + '}}}"]'
  var imageLayers = sketch.find(selector)
  imageLayers.forEach(layer => {
      layer.overrides.forEach(override => {
        if (override.property !== 'image') {
          return
        }

        var srcImage = NSImage.alloc().initByReferencingFile(url.path())
        override.value = srcImage
      })
  })  
}

function exportArtboards(language) {
	var outputs = language["output"]
	var exportFolder = outputFolder.URLByAppendingPathComponent(outputs[0])
  	var pages = sketch.getSelectedDocument().pages
  	pages.forEach(page => {
  		if (page.isSymbolsPage()) {
  			return
  		}

	  	var layers = page.layers
	  	layers.forEach(layer => {
		  	const options = { formats: 'png', output: exportFolder.path(), overwriting: true }
		  	sketch.export(layer, options)
		})
  	})

  	if (outputs.length > 1) {
  		copyOutputFolder(outputs)
  	}

  	UI.message("All done! 🚀")
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
  var selector = 'Text, [name="{{{' + key + '}}}"]'
  var textLayers = sketch.find(selector)
  textLayers.forEach(layer => {
      layer.text = text
  })
}

function readManifest(url) {
	var json = jsonFromFile(url)
	var baseURL = url.URLByDeletingLastPathComponent()
	outputFolder = baseURL.URLByAppendingPathComponent(json["output"])
	var languages = json["languages"]
	languages.forEach(language => {
    	processLanguage(language, baseURL)
  	})
}

function openFolder() {
	var openDialog = NSOpenPanel.openPanel()
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

export default function() {
	openFolder()
}

