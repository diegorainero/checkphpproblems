import puppeteer from 'puppeteer';
import chalk from 'chalk';
import minimist from 'minimist';
import dotenv from 'dotenv';

(async () => {
  dotenv.config();
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const url = process.env.URL_AUTH;

  var argv = minimist(process.argv.slice(2));
  let urlToScan = process.env.URL;

  if (argv.url) {
    urlToScan = argv.url;
  }

  console.log(chalk.yellow(`Crawling - ${urlToScan}`));

  // Array per salvare le URL delle pagine scansionate
  let url_scanned = [];
  let errors = 0;
  let warnings = 0;
  let deprecated = 0;

  // Array per salvare le URL delle chiamate AJAX trovate nel codice sorgente
  let ajaxUrls = [];

  // Avvia il login
  await page.goto(url);

  // Compila il form di login
  await page.type('#myusername', process.env.LOGIN);
  await page.type('#mypassword', process.env.PASSWORD);

  // Invia il form di login
  await Promise.all([
    page.click('#submit'), // Assumi che il pulsante di login abbia questo ID
    page.waitForNavigation(), // Attendi il caricamento della pagina successiva
  ]);

  // Verifica se il login è avvenuto con successo
  const content = await page.content();
  if (content.includes('Errore di login')) {
    console.log(chalk.red('Errore di login!'));
  } else {
    console.log(chalk.green('Login avvenuto con successo!'));

    // Ottieni i cookie di sessione
    const cookies = await page.cookies();

    // Funzione per analizzare il codice alla ricerca di chiamate AJAX
    async function ajaxcrawl(page, url) {
      // Recupera tutto il codice JavaScript della pagina
      const scripts = await page.$$eval('script', (scripts) =>
        scripts.map((script) => script.src).filter((src) => src)
      );

      // Aggiungi il contenuto degli script inline
      const inlineScripts = await page.$$eval('script', (scripts) =>
        scripts
          .filter((script) => !script.src)
          .map((script) => script.textContent)
      );

      // Funzione per analizzare il codice alla ricerca di chiamate AJAX jQuery
      const analyzeJavaScript = (code, scriptUrl) => {
        const ajaxPattern = /\$\.ajax\s*\(\s*{[^}]*url\s*:\s*['"]([^'"]+)['"]/g;

        console.log(`Analizzando lo script: ${scriptUrl}`);

        let match;
        while ((match = ajaxPattern.exec(code)) !== null) {
          console.log(
            `Trovata chiamata AJAX: ${match[1]} nello script: ${scriptUrl}`
          );
          ajaxUrls.push(match[1]);
        }
      };

      // Recupera e analizza il contenuto di tutti gli script esterni
      for (const script of scripts) {
        try {
          const response = await page.goto(script);
          const code = await response.text();
          analyzeJavaScript(code, script);
        } catch (error) {
          console.error(
            `Errore nel recuperare lo script ${script}:`,
            error.message
          );
        }
      }

      // Analizza il contenuto degli script inline
      inlineScripts.forEach((code) => analyzeJavaScript(code, 'inline script'));

      console.log('Tutte le URL delle chiamate AJAX trovate:', ajaxUrls);
    }

    // Funzione di crawling con i cookie di sessione
    async function crawl(page, url) {
      // Ottieni i cookie di sessione
      await page.setCookie(...cookies);
      // Avvia il crawling
      await page.goto(url);

      const content = await page.content();
      if (content.includes('Warning:')) {
        warnings++;
        console.error(chalk.yellow(`Warning PHP trovato nella pagina: ${url}`));
      }
      if (content.includes('Fatal error')) {
        errors++;
        console.error(chalk.red(`Error PHP trovato nella pagina: ${url}`));
      }
      if (content.includes('Deprecated')) {
        deprecated++;
        console.error(
          chalk.magenta(`Deprecated PHP trovato nella pagina: ${url}`)
        );
      }
      // else {
      //   console.info(`Pagina OK: ${url}`);
      // }

      const links = await page.$$eval('a', (as) => as.map((a) => a.href));
      for (let link of links) {
        // Verifica se il link è protetto con i cookie di sessione
        const escapedLink = link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`^(${escapedLink})(?:&lang=\\w+)?(?:#)?$`);

        const exist = (element) => {
          //console.log(pattern, element, pattern.test(element));
          return pattern.test(element);
        };
        if (link.includes('index.php?page') && !url_scanned.some(exist)) {
          url_scanned.push(link);
          await crawl(page, link);
          //await ajaxcrawl(page, link);
        }
      }
    }
    page.on('dialog', async (dialog) => {
      console.log(
        chalk.blue(
          `Alert trovato nella pagina: ${page.url()} ${dialog.message()}`
        )
      );
      await dialog.accept();
    });
    // Avvia il crawling dalla pagina iniziale protetta
    await crawl(page, urlToScan);
  }

  console.log(chalk.bgYellow(`Warning: ${warnings}`));
  console.log(chalk.bgRed(`Error: ${errors}`));
  console.log(chalk.bgMagenta(`Deprecated: ${deprecated}`));
  await browser.close();
})();
