/** Asks before a model is written into a folder that already holds files and
 *  is not a Radical model folder (`documents.saveAsFolder` and
 *  `documents.createFolderDocument`). */
export function confirmForeignFolder(folderName: string): boolean {
  return window.confirm(
    `"${folderName}" already contains files and is not a Radical model folder.\n\n` +
    'Save the model into it anyway? Existing files are kept, except ones with the ' +
    "same names as the model's own files (nodes/…, views.json, metamodel.json, …).",
  )
}
