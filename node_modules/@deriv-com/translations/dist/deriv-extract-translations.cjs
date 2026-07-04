#!/usr/bin/env node

/* eslint-disable */
const path = require("path");
const crc32 = require("crc-32").str;
const fs = require("fs");
const glob = require("glob");
const { DOMParser } = require("@xmldom/xmldom");
const { Command } = require("commander");

const program = new Command();

let SOURCE_DIRECTORY = 'src'

program
  .version("0.1.0")
  .description("Build translation source.")
  .option("-v, --verbose", "Displays the list of paths to be compiled and shows all the message and it's hash.")
  .argument('<srcDir>', "source directory path i.e './src' which is by default './src'")
  .description('source directory of the app from where the script will start finding for strings.')
  .action((str) => {
    SOURCE_DIRECTORY = str.replace(/^\.*\/+|\/+$/g, '');
  });


program.parse(process.argv);

const options = program.opts();


const getRegexPattern = () =>
  /(i18n_default_text={?|localize\()\s*(['"])\s*(.*?)(?<!\\)\2\s*/gs;

const getStringsFromInput = (input, i18n_marker = getRegexPattern()) => {
  const messages = [];
  let result = i18n_marker.exec(input);

  while (result !== null) {
    const extracted = result[3];
    // Replace escape characters.
    messages.push(extracted.replace(/\\/g, ""));
    result = i18n_marker.exec(input);
  }

  return messages;
};

const getStringsFromXmlFile = (input) => {
  const messages = [];
  const parsed_xml = new DOMParser().parseFromString(input, "application/xml");
  const el_categories = parsed_xml.getElementsByTagName("category");

  Array.from(el_categories).forEach((el_category) => {
    const name = el_category.getAttribute("name");
    const description = el_category.getAttribute("description");

    if (name) messages.push(name);
    if (description) messages.push(description);
  });

  return messages;
};

const getTranslatableFiles = () => {
  const globs = ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx", "**/xml/*.xml"];
  const file_paths = [];

    for (let j = 0; j < globs.length; j++) {
      let files_found = glob.sync(
        `./${SOURCE_DIRECTORY}/${globs[j]}`,
        {
          root: path.resolve("."),
        }
      );
      files_found = files_found.filter(
        (file_path) => file_path.indexOf("__tests__") === -1
      );
      file_paths.push(...files_found);
    }

  return file_paths;
};

/** *********************************************
 * Common
 */
const getKeyHash = (string) => crc32(string);

/** **********************************************
 * Compile
 */
(async () => {
  try {
    const file_paths = getTranslatableFiles();
    const messages = [];
    const messages_json = {};

    // Iterate over files and extract all strings from the i18n marker
    for (let i = 0; i < file_paths.length; i++) {
      const file_path = file_paths[i];

      if(options.verbose) {
        console.log(file_path);
      }


      try {
        const file = fs.readFileSync(file_path, "utf8");
        messages.push(
          ...(file_path.endsWith("xml")
            ? getStringsFromXmlFile(file)
            : getStringsFromInput(file))
        );
      } catch (e) {
        console.log(e);
      }
    }

    // Hash the messages and set the key-value pair for json
    for (let i = 0; i < messages.length; i++) {
      const keyHash = getKeyHash(messages[i])
      messages_json[keyHash] = messages[i];


      if(options.verbose) {
        console.log('** key_hash : ', keyHash, ' ** message : ',messages[i]);
      }
    }

    // check if the directory of crowdin exist, if not create the directory of the crowdin first in the root
    const crowdinDir = path.resolve("./crowdin");

    if (!fs.existsSync(crowdinDir)) {
      fs.mkdirSync(crowdinDir)
    }

    // Add to messages.json
    fs.writeFileSync(
      path.resolve("./crowdin/messages.json"),
      JSON.stringify(messages_json),
      "utf8",
      (err) => console.log(err)
    );

    // check if the directory of translations exist, if not create the directory of the translations first in the root
    const translationsDir = path.resolve("./translations");

    if (!fs.existsSync(translationsDir)) {
      fs.mkdirSync(translationsDir)
    }
    // Add to en.json in translations directory
    fs.writeFileSync(
      path.resolve("./translations/en.json"),
      JSON.stringify(messages_json),
      "utf8",
      (err) => console.log(err)
    );

    console.log("********* Translation strings compiled successfully *********")
  } catch (e) {
    program.error(e);
  }
})();
