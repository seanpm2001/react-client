/*
 * SPDX-FileCopyrightText: 2021 The HedgeDoc developers (see AUTHORS file)
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { RefObject, useCallback, useEffect, useRef } from 'react'
import { Logger } from '../../../../utils/logger'

const log = new Logger('IframeLoader')

/**
 * Generates a callback for a iframe load handler, that enforces a given URL if frame navigates away.
 *
 * @param iFrameReference A reference to the iframe react dom element.
 * @param forcedUrl The url that should be enforced.
 * @param onNavigateAway An optional callback that is executed when the iframe leaves the enforced URL.
 */
export const useForceUrlOnIframeLoadCallback = (
  iFrameReference: RefObject<HTMLIFrameElement>,
  forcedUrl: string,
  onNavigateAway?: () => void
): (() => void) => {
  const redirectionInProgress = useRef<boolean>(false)

  useEffect(() => {
    if (!iFrameReference.current) {
      return
    }
    redirectionInProgress.current = true
    iFrameReference.current.src = forcedUrl
  }, [forcedUrl, iFrameReference])

  return useCallback(() => {
    const frame = iFrameReference.current

    if (!frame) {
      log.debug('No frame in reference')
      return
    }

    if (redirectionInProgress.current) {
      redirectionInProgress.current = false
      log.debug('Redirect complete')
    } else {
      log.warn(`Navigated away from unknown URL. Forcing back to ${forcedUrl}`)
      onNavigateAway?.()
      redirectionInProgress.current = true
      frame.src = forcedUrl
    }
  }, [iFrameReference, onNavigateAway, forcedUrl])
}
