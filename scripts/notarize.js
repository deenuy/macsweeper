/**
 * electron-builder afterSign hook — submits the app for Apple notarization.
 * Only runs when NOTARIZE=true and all required env vars are set.
 * Called automatically by electron-builder after code signing.
 */
const { notarize } = require('@electron/notarize')
const path         = require('path')

module.exports = async function afterSign(context) {
  const { electronPlatformName, appOutDir, packager } = context

  if (electronPlatformName !== 'darwin') return
  if (process.env.NOTARIZE !== 'true')   return

  const required = ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']
  const missing  = required.filter((k) => !process.env[k])
  if (missing.length) {
    console.warn(`[notarize] Skipping — missing env vars: ${missing.join(', ')}`)
    return
  }

  const appName  = packager.appInfo.productFilename
  const appPath  = path.join(appOutDir, `${appName}.app`)

  console.log(`[notarize] Submitting ${appPath} to Apple notarization…`)

  await notarize({
    appPath,
    appleId:             process.env.APPLE_ID,
    appleIdPassword:     process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId:              process.env.APPLE_TEAM_ID,
  })

  console.log('[notarize] Done — staple will happen automatically.')
}
