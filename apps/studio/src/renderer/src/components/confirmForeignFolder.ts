/** Asks before a model is written into a folder that already holds files
 *  (`documents.saveAsFolder` and `documents.createFolderDocument`): one that
 *  is not a Radical model folder, or one that holds the Radical model `model`,
 *  which the write replaces. */
export function confirmForeignFolder(folderName: string, model?: string): boolean {
  if (model !== undefined) {
    return window.confirm(
      `"${folderName}" holds the model "${model}".\n\n` +
      `Replace it with this model? "${model}" is overwritten: its elements, its views and the rest of its files.`,
    )
  }
  return window.confirm(
    `"${folderName}" already contains files and is not a Radical model folder.\n\n` +
    'Save the model into it anyway? Existing files are kept, except ones with the ' +
    "same names as the model's own files (nodes/…, views.json, metamodel.json, …).",
  )
}
