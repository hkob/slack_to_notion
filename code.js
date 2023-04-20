// ver 0.3: multiple workspace support
// ver 0.2: add page when the reaction is the first one.
// ver 0.1: first release

function storeTokenAndIds() {
  const scriptProperties = PropertiesService.getScriptProperties()
  scriptProperties.setProperties({
    // "VERIFICATION_TOKEN1": "BOT_USER_OAUTH_TOKEN1",
    // "VERIFICATION_TOKEN2": "BOT_USER_OAUTH_TOKEN2",
    // "VERIFICATION_TOKEN3": "BOT_USER_OAUTH_TOKEN3",
    "@@@ Paste your verification token in Sec.10 @@@@": "@@@ Paste your Bot User OAuth Token in Sec. 10 @@@",
    "MY_NOTION_TOKEN": "@@@ Paste your Integration token @@@",
    "DATABASE_ID": "@@@ Paste your database_id like as 771391e755c245b2a31290f40f187ab9 @@@"
  })
  // Confirm that the above registration was successful
  const properties = PropertiesService.getScriptProperties().getProperties()
  for (let key in properties) {
    console.log(key + " = " + properties[key])
  }
}

function testCreateNotionPage() {
  const title = "Test title"
  const userDisplayName = "test user"
  const channelName = "test channel"
  const teamName = "hkob-labo"
  const children = [{"type": "breadcrumb", "breadcrumb": {}}]
  createPage(createPayload(title, userDisplayName, channelName, teamName, children))
}

function outputSheet(str, cell) {
  const sheet = SpreadsheetApp.getActiveSheet()
  sheet.getRange(cell).setValue(str)
}

function doPost(e) {
  const reactionType = "pushpin"
  const json = JSON.parse(e.postData.contents)
  if (json.type == "url_verification") {
    return ContentService.createTextOutput(json.challenge)
  } else if (json.type == "event_callback") {
    const botToken = slackBotToken(json.token)
    if (botToken && json.event.reaction == reactionType) {
      createNotionPage(json, reactionType, botToken)
    }
  }
  return ContentService.createTextOutput("Ok")
}

function countReactionType(message, reactionType) {
  return message.reactions.filter(r => r.name == reactionType).map(r => r.count)[0]
}

function createNotionPage(json, reactionType, botToken) {
  const message = getSlackMessage(json.event.item.channel, json.event.item.ts, botToken).messages[0]
  console.log(message)
  if (countReactionType(message, reactionType) == 1) {
    const title = message.text.split("\n")[0]
    outputSheet(title, "A1")
    const userDisplayName = getUserDisplayName(json.event.item_user, botToken)
    outputSheet(userDisplayName, "A2")
    const channelName = getChannelName(json.event.item.channel, botToken)
    outputSheet(channelName, "A3")
    const teamName = getTeamName(botToken)
    outputSheet(teamName, "A4")
    outputSheet(JSON.stringify(message.blocks), "A5")
    const children = convertBlock(message.blocks)
    outputSheet(JSON.stringify(children), "A6")
    createPage(createPayload(title, userDisplayName, channelName, teamName, children))
  }
}

function getSlackMessage(channel, ts, botToken) {
  return sendSlack("https://slack.com/api/conversations.replies?channel=" + channel + "&ts=" + ts + "&limit=1", botToken)
}

function getUserDisplayName(user_id, botToken) {
  const profile = sendSlack("https://slack.com/api/users.info?user=" + user_id, botToken).user.profile
  return profile.display_name == "" ? profile.real_name : profile.display_name
}

function getChannelName(channel_id, botToken) {
  return sendSlack("https://slack.com/api/conversations.info?channel=" + channel_id, botToken).channel.name
}

function getTeamName(botToken) {
  return sendSlack("https://slack.com/api/team.info", botToken).team.name
}

function richTextSection(element, embed) {
  var ans
  switch (element.type) {
    case "text":
      ans = {
        "type": "text",
        "text": {
          "content": element.text,
        }
      }
      if ("style" in element) {
        ans.annotations = element.style
        if (ans.annotations.strike) {
          ans.annotations.strikethrough = true
          delete ans.annotations.strike
        }
      }
      return ans
    case "link":
      const url = element.url
      ans = {
        "type": "text",
        "text": {
          "content": element.text || url,
          "link": {
            "url": url
          }
        }
      }
      if (url.startsWith("https://twitter.com")) {
        embed["twitter"].push(url)
      }
      return ans
  }
}

function elementsToRichTextAndTwitter(elements, embed) {
  return elements.map((element) => richTextSection(element, embed)).filter(Boolean)
}

function convertBlock(blocks) {
  const ans = []
  const list_buffer = []
  const embed = { "twitter": [] }
  blocks.forEach((block) => {
    if (block.type == "rich_text") {
      block.elements.forEach((element) => {
        if (list_buffer.length > 0) {
          if (element.type != "rich_text_list" || element.indent == 0) {
            ans.push(list_buffer.shift())
          }
        }
        switch (element.type) {
          case "rich_text_section":
            ans.push({
              "type": "paragraph",
              "object": "block",
              "paragraph": {
                "rich_text": elementsToRichTextAndTwitter(element.elements, embed)
              }
            })
            break
          case "rich_text_preformatted":
            ans.push({
              "type": "code",
              "object": "block",
              "code": {
                "rich_text": elementsToRichTextAndTwitter(element.elements, embed),
                "language": "plain text"
              }
            })
            break
          case "rich_text_list":
            const block_type = element.style == "ordered" ? "numbered_list_item" : "bulleted_list_item"
            element.elements.forEach((list_element) => {
              list_element.elements.forEach((sub_element) => {
                if (list_buffer.length > 0) {
                  if (element.indent == 0) {
                    ans.push(list_buffer.shift())
                  }
                }
                const rt = richTextSection(sub_element, embed)
                if (rt) {
                  const list = {
                    "type": block_type,
                    "object": "block"
                  }
                  list[block_type] = {
                    "rich_text": [rt]
                  }
                  var indent = element.indent
                  var pointer = list_buffer
                  while (indent > 0) {
                    if (pointer.length > 0) {
                      const child = pointer[pointer.length - 1]
                      const child_type = child.type
                      if ("children" in child[child_type]) {
                        pointer = child[child_type].children
                      } else {
                        child[child_type].children = []
                        pointer = child[child_type].children
                      }
                      indent--
                    } else {
                      break
                    }
                  }
                  pointer.push(list)
                }
              })
            })
        }
      })
      if (list_buffer.length > 0) {
        ans.push(list_buffer.shift())
      }
    }
  })
  embed.twitter.forEach((url) => {
    ans.push({
      "type": "embed",
      "object": "block",
      "embed": {
        "url": url
      }
    })
  })
  return ans
}

function sendSlack(url, botToken) {
  const options = {
    "headers": {
      "Content-type": "application/json; charset=utf-8",
      "Authorization": "Bearer " + botToken
    }
  }
  return JSON.parse(UrlFetchApp.fetch(url, options))
}

function sendNotion(url, payload, method) {
  let options = {
    "method": method,
    "headers": {
      "Content-type": "application/json",
      "Authorization": "Bearer " + myNotionToken(),
      "Notion-Version": "2022-06-28",
    },
    "payload": payload ? JSON.stringify(payload) : null
  }
  return JSON.parse(UrlFetchApp.fetch(url, options))
}

function createPage(payload) {
  return sendNotion("https://api.notion.com/v1/pages", payload, "POST")
}

function createPayload(title, userDisplayNme, channelName, teamName, children) {
  return {
    "parent": {
      "database_id": databaseId()
    },
    "properties": {
      "text": {
        "title": [
          {
            "text": {
              "content": title
            }
          }
        ]
      },
      "user_name": {
        "type": "select",
        "select": {
          "name": userDisplayNme
        }
      },
      "channel_name": {
        "type": "select",
        "select": {
          "name": channelName
        }
      },
      "workspace_name": {
        "type": "select",
        "select": {
          "name": teamName
        }
      }
    },
    "children": children
  }
}

function myNotionToken() {
  return PropertiesService.getScriptProperties().getProperty("MY_NOTION_TOKEN")
}

function databaseId() {
  return PropertiesService.getScriptProperties().getProperty("DATABASE_ID")
}

function slackBotToken(verificationToken) {
  return PropertiesService.getScriptProperties().getProperty(verificationToken)
}
