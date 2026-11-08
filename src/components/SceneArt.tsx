import { useId } from "react";
import type { SceneId } from "../../shared/types";
export function SceneArt({
  scene = "cafe",
  variant = 0,
  className = "",
}: {
  scene?: SceneId;
  variant?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  if (scene === "foundation")
    return (
      <svg
        className={className}
        viewBox="0 0 600 400"
        role="img"
        aria-label={
          variant < 2
            ? "A glass of water, an empty cup, and a coffee on a table"
            : variant < 4
              ? "A hand giving a cup to another person"
              : variant < 6
                ? "One cup next to a pair of two cups"
                : "A glass of water and a replay symbol"
        }
      >
        <rect width="600" height="400" fill="#e8e8d7" />
        <circle cx="468" cy="96" r="47" fill="#f7efd4" />
        <path d="M0 282Q300 261 600 282v118H0" fill="#d7b996" />
        <path d="M25 290h550" stroke="#c6a77f" strokeWidth="3" />
        {variant >= 2 && variant < 4 ? (
          <g>
            <path d="M20 210l130-25 75 32-10 30-72-5L20 267" fill="#d2a581" />
            <path d="M580 211l-112 10-62 30 3 29 81-21 90-1" fill="#e5c19f" />
            <path d="M255 170h85l-6 88q-35 23-70 0z" fill="#fffaf0" />
            <path
              d="M340 188q40 0 26 35l-29 6"
              fill="none"
              stroke="#fffaf0"
              strokeWidth="12"
            />
            <path
              className="give-arrow"
              d="M180 126h239m-27-20 27 20-27 20"
              fill="none"
              stroke="#92a27a"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <circle cx="82" cy="88" r="27" fill="#dbb58f" />
            <circle cx="517" cy="91" r="27" fill="#cda17b" />
          </g>
        ) : variant >= 4 && variant < 6 ? (
          <g>
            {[130, 350, 450].map((x) => (
              <g key={x}>
                <path
                  d={`M${x - 34} 177h68l-5 90q-27 17-58 0z`}
                  fill="#fffaf0"
                />
                <path
                  d={`M${x + 34} 190q34 0 22 31l-25 5`}
                  stroke="#fffaf0"
                  strokeWidth="10"
                  fill="none"
                />
              </g>
            ))}
            <text x="121" y="338" fill="#8a9b72" fontSize="28">
              1
            </text>
            <text x="390" y="338" fill="#8a9b72" fontSize="28">
              2
            </text>
            <path
              d="M275 123v214"
              stroke="#c4ccb0"
              strokeWidth="2"
              strokeDasharray="7 7"
            />
          </g>
        ) : (
          <g>
            <path
              d="M92 147h111l-13 127q-42 20-85 0z"
              fill="#f8fcf3"
              stroke="#c5d5c7"
              strokeWidth="3"
            />
            <path d="M100 202q47 12 96 0l-7 70q-42 16-83 0z" fill="#b5d3ce" />
            <path d="M143 109q-26-28 0-57 27 30 0 57" fill="#a4c7c0" />
            <path d="M263 197h76l-7 73q-31 17-62 0z" fill="#fffaf0" />
            <path
              d="M338 207q36-2 24 31l-27 7"
              fill="none"
              stroke="#fffaf0"
              strokeWidth="11"
            />
            <path d="M421 176h78l-8 91q-31 19-62 0z" fill="#f8f1db" />
            <ellipse cx="460" cy="176" rx="39" ry="7" fill="#89705a" />
            <path
              d="M497 190q37-2 26 30l-29 8"
              fill="none"
              stroke="#f8f1db"
              strokeWidth="10"
            />
            <path
              d="M446 154q-14-18 0-36m22 36q-14-18 0-36"
              fill="none"
              stroke="#fffdf3"
              strokeWidth="4"
            />
            {variant >= 6 && (
              <path
                d="M280 99a30 30 0 11-11 32m-1-26 11-6 4 16"
                fill="none"
                stroke="#8ba176"
                strokeWidth="6"
                strokeLinecap="round"
              />
            )}
          </g>
        )}
        <path d="M40 374h520" stroke="#c9aa82" strokeWidth="2" />
      </svg>
    );
  if (scene === "directions")
    return (
      <svg
        className={className}
        viewBox="0 0 600 400"
        role="img"
        aria-label="A quiet town with a park, train station, and signposts"
      >
        <rect width="600" height="400" fill="#dde6df" />
        <circle cx="475" cy="76" r="38" fill="#f7e9b2" />
        <path d="M0 290Q110 190 220 240T600 210V400H0" fill="#aabc9d" />
        <path d="M240 400L300 220h50l80 180" fill="#ede7db" />
        <path
          d="M325 400V245"
          stroke="#cdbfa4"
          strokeWidth="4"
          strokeDasharray="16 16"
        />
        <rect x="50" y="155" width="160" height="125" rx="7" fill="#eec8aa" />
        <path d="M30 156l100-80 100 80" fill="#8b9b87" />
        <rect x="105" y="204" width="48" height="76" fill="#f7f1df" />
        <rect x="70" y="180" width="26" height="35" fill="#7c958c" />
        <path d="M440 298V135" stroke="#7e785b" strokeWidth="9" />
        <path d="M395 145h112l22 17-22 17H395z" fill="#f7efd9" />
        <text x="411" y="168" fontSize="19" fill="#536348">
          PARK →
        </text>
        <path d="M380 191h122v34H380l-20-17z" fill="#536348" />
        <text x="386" y="214" fontSize="17" fill="#fff7df">
          ← STATION
        </text>
        <path d="M545 330V199" stroke="#87785b" strokeWidth="12" />
        <circle cx="542" cy="189" r="51" fill="#7e9b71" />
        <circle cx="516" cy="220" r="37" fill="#8eab7f" />
        <path
          d="M30 351Q90 316 150 353"
          stroke="#839a70"
          fill="none"
          strokeWidth="15"
        />
      </svg>
    );
  if (scene === "friends")
    return (
      <svg
        className={className}
        viewBox="0 0 600 400"
        role="img"
        aria-label="Two friends having a conversation in a sunny park"
      >
        <rect width="600" height="400" fill="#e9e2ed" />
        <circle cx="466" cy="88" r="43" fill="#f4dcaa" />
        <path d="M0 296Q180 232 300 285T600 280v120H0" fill="#b9c4a4" />
        <rect x="110" y="276" width="380" height="22" rx="9" fill="#a88b6d" />
        <path d="M145 295v85m310-85v85" stroke="#89745e" strokeWidth="14" />
        <path d="M162 285q-13-115 55-112t65 112" fill="#bc7d61" />
        <ellipse cx="220" cy="134" rx="38" ry="44" fill="#ecc8a9" />
        <path d="M184 128q-5-62 44-44 37 2 29 53l-20-29-53 20" fill="#555547" />
        <path d="M282 285q-15-111 57-111t70 111" fill="#7b8f86" />
        <ellipse cx="340" cy="135" rx="38" ry="45" fill="#dab390" />
        <path d="M300 141q-8-70 40-66 55 0 42 81l-20-51-62 36" fill="#5e5445" />
        <path
          d="M210 210l54 46 47-41"
          fill="none"
          stroke="#e6bfa1"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <rect x="76" y="60" width="113" height="57" rx="20" fill="#fff8e9" />
        <path d="M165 112l15 17-2-23" fill="#fff8e9" />
        <text x="98" y="98" fontSize="25" fill="#627059">
          Hello!
        </text>
        <path d="M500 300V142" stroke="#917963" strokeWidth="10" />
        <circle cx="508" cy="132" r="61" fill="#8da282" />
        <circle cx="550" cy="165" r="41" fill="#9cad8d" />
      </svg>
    );
  if (scene === "shop")
    return (
      <svg
        className={className}
        viewBox="0 0 600 400"
        role="img"
        aria-label="A friendly neighborhood shop with apples, bread and a shopping bag"
      >
        <rect width="600" height="400" fill="#dfe7d5" />
        <rect x="66" y="71" width="468" height="292" rx="8" fill="#f6efdf" />
        <rect x="64" y="80" width="472" height="58" fill="#829771" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path
            key={i}
            d={`M${64 + i * 79} 80h39v81q-20 24-39 0z`}
            fill="#eee9ce"
          />
        ))}
        <text x="220" y="57" fill="#536348" fontFamily="Georgia" fontSize="28">
          little market
        </text>
        <rect x="113" y="188" width="184" height="101" rx="4" fill="#c5d0b2" />
        <rect x="324" y="168" width="154" height="195" rx="4" fill="#b7c4a5" />
        <rect x="341" y="187" width="119" height="112" fill="#e5ead8" />
        <circle cx="450" cy="322" r="5" fill="#7a825b" />
        <rect x="93" y="279" width="227" height="75" rx="6" fill="#b89c75" />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <circle
              cx={117 + i * 40}
              cy={278 + (i % 2) * 7}
              r="18"
              fill={i % 2 ? "#b2b16c" : "#bb7153"}
            />
            <path
              d={`M${117 + i * 40} 260l5-9`}
              stroke="#62714f"
              strokeWidth="3"
            />
          </g>
        ))}
        <path d="M398 344l-8-64h65l-8 64" fill="#d9bc87" />
        <path
          d="M408 283v-11a14 14 0 0128 0v11"
          fill="none"
          stroke="#947d59"
          strokeWidth="5"
        />
        <rect x="20" y="350" width="560" height="22" rx="6" fill="#bac8a4" />
      </svg>
    );
  return (
    <svg
      className={className}
      viewBox="0 0 600 400"
      role="img"
      aria-label={
        variant
          ? "Another café with tea and coffee to go"
          : "A warm corner café with a barista, small coffee and large tea"
      }
    >
      <defs>
        <linearGradient id={id} x2="0" y2="1">
          <stop stopColor={variant ? "#d5dcc7" : "#e7cbb1"} />
          <stop offset="1" stopColor={variant ? "#e9edda" : "#f3e3cf"} />
        </linearGradient>
      </defs>
      <rect width="600" height="400" fill={`url(#${id})`} />
      <path d="M0 0h600v40H0" fill="#dfbda0" />
      <rect x="52" y="45" width="175" height="188" rx="90" fill="#faf1dc" />
      <path d="M139 46v186M52 135h174" stroke="#d8b796" strokeWidth="8" />
      <path d="M63 223q43-61 76-26t78-12" fill="#c3ccad" />
      <rect
        x="282"
        y="68"
        width="124"
        height="111"
        rx="6"
        fill="#68725c"
        stroke="#b59976"
        strokeWidth="8"
      />
      <text x="306" y="103" fontFamily="Georgia" fontSize="23" fill="#f5ecd8">
        the daily
      </text>
      <text
        x="319"
        y="130"
        fontFamily="Georgia"
        fontStyle="italic"
        fontSize="27"
        fill="#f5ecd8"
      >
        brew
      </text>
      <path d="M310 151h67" stroke="#c7c8a5" strokeWidth="2" />
      <path
        d="M470 30v47m-34 22q35-48 70 0z"
        fill="#6f755a"
        stroke="#6f755a"
        strokeWidth="5"
      />
      <ellipse cx="471" cy="100" rx="35" ry="6" fill="#eee0b9" />
      <path d="M307 284q-4-94 54-94 60 0 57 94" fill="#f1e8d3" />
      <ellipse cx="361" cy="156" rx="33" ry="39" fill="#d4a584" />
      <path d="M329 154q-13-52 29-50 41-8 39 50l-18-27-50 27" fill="#595344" />
      <path d="M337 211l22 18 22-18 18 79h-79z" fill="#7c8a6b" />
      <path
        d="M349 165q13 10 24 0"
        fill="none"
        stroke="#9e745a"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="0" y="278" width="600" height="122" fill="#c49b73" />
      <rect x="0" y="271" width="600" height="15" rx="4" fill="#9c7d5f" />
      <path d="M30 299h540v101H30z" fill="#cfa981" />
      <path
        d="M44 303v97m48-97v97m48-97v97m48-97v97m48-97v97m48-97v97m48-97v97m48-97v97m48-97v97m48-97v97m48-97v97"
        stroke="#b89169"
        strokeWidth="2"
      />
      <ellipse cx="190" cy="269" rx="49" ry="8" fill="#e4ceb0" />
      <path d="M161 228h52l-5 34q-20 15-42 0z" fill="#f9f4e7" />
      <path
        d="M213 234q26-2 15 18l-17 3"
        fill="none"
        stroke="#f9f4e7"
        strokeWidth="7"
      />
      <ellipse cx="187" cy="228" rx="26" ry="5" fill="#705747" />
      <path
        d="M180 210q-10-12 1-24m15 24q-10-12 1-24"
        fill="none"
        stroke="#fff8e9"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M248 215h44l-5 52h-34z" fill="#e4e8ca" />
      <rect x="245" y="211" width="50" height="8" rx="3" fill="#f8f4df" />
      <path d="M254 231h34v21h-34" fill="#8c9b73" />
      <path
        d="M72 271v-50m0 15q-29 4-28-30 28 0 28 30m1-8q24 0 26-27-28-1-26 27"
        fill="#83926c"
        stroke="#83926c"
        strokeWidth="4"
      />
      <path d="M51 245h44l-5 26H56z" fill="#c58564" />
      <rect x="459" y="214" width="86" height="57" rx="6" fill="#64735b" />
      <rect x="469" y="222" width="66" height="34" rx="3" fill="#b9c9b0" />
      <path d="M502 271v-11" stroke="#64735b" strokeWidth="8" />
    </svg>
  );
}
