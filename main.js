const WORKER =
  "https://espn-fantasy-recap.l-rath-variotech.workers.dev";

Deno.serve(async (request) => {
  const url = new URL(request.url);

  // Health Check
  if (url.pathname === "/" || url.pathname === "/health") {
    return new Response("ESPN Fantasy Recap – OK", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  let week = null;

  // /recap?week=2
  if (url.pathname === "/recap") {
    week = url.searchParams.get("week");
  }

  // /week/2
  const weekMatch = url.pathname.match(/^\/week\/(\d+)$/);

  if (weekMatch) {
    week = weekMatch[1];
  }

  if (!week) {
    return json(
      {
        error: "Keine Woche angegeben",
        examples: [
          "/recap?week=2",
          "/week/2",
        ],
      },
      400
    );
  }

  const weekNumber = Number(week);

  if (!Number.isInteger(weekNumber) || weekNumber < 1) {
    return json(
      {
        error: "Ungültige Woche",
        details: "Die Woche muss eine positive ganze Zahl sein.",
      },
      400
    );
  }

  return createRecap(weekNumber);
});


/* =========================================================
   ESPN DATEN ABRUFEN
   ========================================================= */

async function getESPNData(week) {
  const target =
    `${WORKER}/recap?week=${encodeURIComponent(week)}&compact=1`;

  const response = await fetch(target);

  if (!response.ok) {
    throw new Error(
      `Cloudflare Worker antwortete mit HTTP ${response.status}`
    );
  }

  return await response.json();
}


/* =========================================================
   RECAP ERSTELLEN
   ========================================================= */

async function createRecap(week) {
  try {
    const data = await getESPNData(week);

    const teams = Array.isArray(data.teams)
      ? data.teams
      : [];

    const matchups = Array.isArray(data.matchups)
      ? data.matchups
      : [];

    const standings = Array.isArray(data.standings)
      ? data.standings
      : [];

    const roster = Array.isArray(data.roster)
      ? data.roster
      : [];

    const transactions = Array.isArray(data.transactions)
      ? data.transactions
      : [];


    /* =====================================================
       MATCHUPS AUFBEREITEN
       ===================================================== */

    const games = [];

    for (const matchup of matchups) {
      if (!matchup.home?.team && !matchup.away?.team) {
        continue;
      }

      const homeScore = Number(
        matchup.home?.score || 0
      );

      const awayScore = Number(
        matchup.away?.score || 0
      );

      let winner = null;
      let loser = null;

      if (homeScore > awayScore) {
        winner = matchup.home;
        loser = matchup.away;
      } else if (awayScore > homeScore) {
        winner = matchup.away;
        loser = matchup.home;
      }

      games.push({
        home: matchup.home,
        away: matchup.away,
        winner,
        loser,
        margin: Math.abs(homeScore - awayScore),
      });
    }


    /* =====================================================
       SCORES
       ===================================================== */

    const scores = [];

    for (const game of games) {
      if (game.home?.team) {
        scores.push({
          team: game.home.team,
          score: Number(game.home.score || 0),
        });
      }

      if (game.away?.team) {
        scores.push({
          team: game.away.team,
          score: Number(game.away.score || 0),
        });
      }
    }

    scores.sort(
      (a, b) => b.score - a.score
    );

    const highestScore =
      scores[0] || null;

    const lowestScore =
      scores[scores.length - 1] || null;


    /* =====================================================
       SPIEL DER WOCHE / KLARSTER SIEG
       ===================================================== */

    const sortedByMargin = [...games]
      .filter(
        (game) =>
          game.winner &&
          game.loser
      )
      .sort(
        (a, b) =>
          a.margin - b.margin
      );

    const closestGame =
      sortedByMargin[0] || null;

    const biggestBlowout =
      sortedByMargin[
        sortedByMargin.length - 1
      ] || null;


    /* =====================================================
       SPIELER
       ===================================================== */

    const players = [];

    for (const teamRoster of roster) {
      if (
        !Array.isArray(
          teamRoster.players
        )
      ) {
        continue;
      }

      for (const player of teamRoster.players) {
        if (player.points == null) {
          continue;
        }

        players.push({
          playerId: player.playerId,
          name: player.name,
          team: teamRoster.team,
          position: player.position,
          points: Number(player.points),
        });
      }
    }

    players.sort(
      (a, b) => b.points - a.points
    );

    const topPlayers =
      players.slice(0, 5);


    /* =====================================================
       POWER RANKING
       ===================================================== */

    const powerRanking = [...standings]
      .map((team) => {
        const wins =
          Number(team.wins || 0);

        const pointsFor =
          Number(team.pointsFor || 0);

        return {
          ...team,

          // Bilanz + erzielte Punkte
          rankingScore:
            wins * 1000 +
            pointsFor,
        };
      })
      .sort(
        (a, b) =>
          b.rankingScore -
          a.rankingScore
      );


    /* =====================================================
       TRANSAKTIONEN
       ===================================================== */

    const transactionCount =
      transactions.length;

    const transactionTypes = {};

    for (const transaction of transactions) {
      const type =
        transaction.type ||
        "UNKNOWN";

      transactionTypes[type] =
        (transactionTypes[type] || 0) +
        1;
    }


    /* =====================================================
       RECAP TEXT
       ===================================================== */

    const lines = [];

    lines.push(
      `🏈 ESPN FANTASY FOOTBALL – WEEK ${week} RECAP`
    );

    lines.push("");

    lines.push(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    lines.push("");


    /* =====================================================
       MATCHUPS
       ===================================================== */

    lines.push("🔥 MATCHUPS");
    lines.push("");

    for (const game of games) {
      const home = game.home;
      const away = game.away;

      if (
        !home?.team ||
        !away?.team
      ) {
        continue;
      }

      const homeScore =
        Number(home.score || 0);

      const awayScore =
        Number(away.score || 0);

      let result;

      if (homeScore > awayScore) {
        result =
          `🏆 ${home.team} gewinnt mit ` +
          `${homeScore.toFixed(2)} : ` +
          `${awayScore.toFixed(2)}`;
      } else if (awayScore > homeScore) {
        result =
          `🏆 ${away.team} gewinnt mit ` +
          `${awayScore.toFixed(2)} : ` +
          `${homeScore.toFixed(2)}`;
      } else {
        result =
          `🤝 Unentschieden ` +
          `${homeScore.toFixed(2)} : ` +
          `${awayScore.toFixed(2)}`;
      }

      lines.push(
        `${home.team} ${homeScore.toFixed(2)} – ` +
        `${awayScore.toFixed(2)} ${away.team}`
      );

      lines.push(result);
      lines.push("");
    }


    /* =====================================================
       SPIEL DER WOCHE
       ===================================================== */

    if (closestGame) {
      lines.push("⚔️ SPIEL DER WOCHE");
      lines.push("");

      lines.push(
        `${closestGame.home.team} ` +
        `${Number(
          closestGame.home.score
        ).toFixed(2)} – ` +
        `${Number(
          closestGame.away.score
        ).toFixed(2)} ` +
        `${closestGame.away.team}`
      );

      lines.push(
        `Nur ${closestGame.margin.toFixed(2)} ` +
        `Punkte Unterschied.`
      );

      lines.push("");
    }


    /* =====================================================
       KLARSTER SIEG
       ===================================================== */

    if (
      biggestBlowout &&
      biggestBlowout.margin > 0
    ) {
      lines.push("💀 KLARSTER SIEG");
      lines.push("");

      lines.push(
        `${biggestBlowout.winner.team} schlägt ` +
        `${biggestBlowout.loser.team} ` +
        `mit ${biggestBlowout.margin.toFixed(2)} ` +
        `Punkten Vorsprung.`
      );

      lines.push("");
    }


    /* =====================================================
       TOP SCORE
       ===================================================== */

    if (highestScore) {
      lines.push(
        "🚀 TOP SCORE DER WOCHE"
      );

      lines.push("");

      lines.push(
        `${highestScore.team}: ` +
        `${highestScore.score.toFixed(2)} Punkte`
      );

      lines.push("");
    }


    /* =====================================================
       LOW SCORE
       ===================================================== */

    if (lowestScore) {
      lines.push(
        "🥶 LOW SCORE DER WOCHE"
      );

      lines.push("");

      lines.push(
        `${lowestScore.team}: ` +
        `${lowestScore.score.toFixed(2)} Punkte`
      );

      lines.push("");
    }


    /* =====================================================
       TOP PERFORMER
       ===================================================== */

    if (topPlayers.length > 0) {
      lines.push("⭐ TOP-PERFORMER");
      lines.push("");

      for (
        let i = 0;
        i < topPlayers.length;
        i++
      ) {
        const player =
          topPlayers[i];

        lines.push(
          `${i + 1}. ${player.name} – ` +
          `${player.points.toFixed(2)} Punkte ` +
          `(${player.team})`
        );
      }

      lines.push("");
    }


    /* =====================================================
       STANDINGS
       ===================================================== */

    if (standings.length > 0) {
      lines.push(
        "🏆 AKTUELLE STANDINGS"
      );

      lines.push("");

      standings.forEach(
        (team, index) => {
          lines.push(
            `${index + 1}. ${team.team} – ` +
            `${team.wins}-${team.losses}` +
            `${
              team.ties
                ? `-${team.ties}`
                : ""
            } | ` +
            `${Number(
              team.pointsFor || 0
            ).toFixed(2)} PF`
          );
        }
      );

      lines.push("");
    }


    /* =====================================================
       POWER RANKING
       ===================================================== */

    if (powerRanking.length > 0) {
      lines.push(
        "📊 POWER RANKING"
      );

      lines.push("");

      powerRanking.forEach(
        (team, index) => {
          lines.push(
            `${index + 1}. ${team.team}`
          );
        }
      );

      lines.push("");

      lines.push(
        "Hinweis: Das Power Ranking ist " +
        "eine Recap-interne Auswertung " +
        "aus Bilanz und erzielten Punkten " +
        "und kein offizielles ESPN-Ranking."
      );

      lines.push("");
    }


    /* =====================================================
       TRANSAKTIONEN
       ===================================================== */

    lines.push("🔄 TRANSAKTIONEN");
    lines.push("");

    if (transactionCount === 0) {
      lines.push(
        "Keine Transaktionen für diese " +
        "Woche gefunden."
      );
    } else {
      lines.push(
        `${transactionCount} Transaktion(en) ` +
        `registriert.`
      );

      for (
        const [type, count]
        of Object.entries(
          transactionTypes
        )
      ) {
        lines.push(
          `• ${type}: ${count}`
        );
      }
    }

    lines.push("");


    /* =====================================================
       FOOTER
       ===================================================== */

    lines.push(
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    );

    lines.push("");

    lines.push(
      `Week ${week} ist damit abgeschlossen.`
    );

    lines.push(
      "Datenquelle: ESPN Fantasy Football"
    );


    /* =====================================================
       RESPONSE
       ===================================================== */

    const recap =
      lines.join("\n");

    return new Response(
      recap,
      {
        status: 200,
        headers: {
          "Content-Type":
            "text/plain; charset=utf-8",

          "Access-Control-Allow-Origin":
            "*",

          "Cache-Control":
            "no-store",
        },
      }
    );

  } catch (error) {
    return json(
      {
        error:
          "Recap konnte nicht erstellt werden",

        details:
          String(error),
      },
      502
    );
  }
}


/* =========================================================
   JSON HELPER
   ========================================================= */

function json(
  data,
  status = 200
) {
  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),
    {
      status,

      headers: {
        "Content-Type":
          "application/json; charset=utf-8",

        "Access-Control-Allow-Origin":
          "*",

        "Cache-Control":
          "no-store",
      },
    }
  );
}
