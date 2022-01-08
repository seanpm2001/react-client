/*
 * SPDX-FileCopyrightText: 2021 The HedgeDoc developers (see AUTHORS file)
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useEditorReceiveHandler } from '../../../render-page/window-post-message-communicator/hooks/use-editor-receive-handler'
import type { ImageUploadMessage } from '../../../render-page/window-post-message-communicator/rendering-message'
import { CommunicationMessageType } from '../../../render-page/window-post-message-communicator/rendering-message'
import { useCallback } from 'react'
import { getGlobalState } from '../../../../redux'
import { handleUpload } from '../upload-handler'
import { Logger } from '../../../../utils/logger'
import { findRegexMatchInText } from '../find-regex-match-in-text'
import Optional from 'optional-js'
import type { CursorSelection } from '../../../../redux/editor/types'

const log = new Logger('useOnImageUpload')
const imageWithPlaceholderLinkRegex = /!\[([^\]]*)]\(https:\/\/([^)]*)\)/g

/**
 * Receives {@link CommunicationMessageType.IMAGE_UPLOAD image upload events} via iframe communication and processes the attached uploads.
 */
export const useOnImageUploadFromRenderer = (): void => {
  useEditorReceiveHandler(
    CommunicationMessageType.IMAGE_UPLOAD,
    useCallback((values: ImageUploadMessage) => {
      const { dataUri, fileName, lineIndex, placeholderIndexInLine } = values
      if (!dataUri.startsWith('data:image/')) {
        log.error('Received uri is no data uri and image!')
        return
      }

      fetch(dataUri)
        .then((result) => result.blob())
        .then((blob) => {
          const file = new File([blob], fileName, { type: blob.type })
          const { cursorSelection, alt, title } = Optional.ofNullable(lineIndex)
            .map((actualLineIndex) => findPlaceholderInMarkdownContent(actualLineIndex, placeholderIndexInLine))
            .orElseGet(() => ({}))
          handleUpload(file, cursorSelection, alt, title)
        })
        .catch((error) => log.error(error))
    }, [])
  )
}

export interface ExtractResult {
  cursorSelection?: CursorSelection
  alt?: string
  title?: string
}

/**
 * Calculates the start and end cursor position of the right image placeholder in the current markdown content.
 *
 * @param lineIndex The index of the line to change in the current markdown content.
 * @param replacementIndexInLine If multiple image placeholders are present in the target line then this number describes the index of the wanted placeholder.
 * @return the calculated start and end position or undefined if no position could be determined
 */
const findPlaceholderInMarkdownContent = (lineIndex: number, replacementIndexInLine = 0): ExtractResult | undefined => {
  const currentMarkdownContentLines = getGlobalState().noteDetails.markdownContent.split('\n')
  const lineAtIndex = currentMarkdownContentLines[lineIndex]
  if (lineAtIndex === undefined) {
    return
  }
  return findImagePlaceholderInLine(currentMarkdownContentLines[lineIndex], lineIndex, replacementIndexInLine)
}

/**
 * Tries to find the right image placeholder in the given line.
 *
 * @param line The line that should be inspected
 * @param lineIndex The index of the line in the document
 * @param replacementIndexInLine If multiple image placeholders are present in the target line then this number describes the index of the wanted placeholder.
 * @return the calculated start and end position or undefined if no position could be determined
 */
const findImagePlaceholderInLine = (
  line: string,
  lineIndex: number,
  replacementIndexInLine = 0
): ExtractResult | undefined => {
  const startOfImageTag = findRegexMatchInText(line, imageWithPlaceholderLinkRegex, replacementIndexInLine)
  if (startOfImageTag === undefined || startOfImageTag.index === undefined) {
    return
  }

  return {
    cursorSelection: {
      from: {
        character: startOfImageTag.index,
        line: lineIndex
      },
      to: {
        character: startOfImageTag.index + startOfImageTag[0].length,
        line: lineIndex
      }
    },
    alt: startOfImageTag[1],
    title: startOfImageTag[2]
  }
}
