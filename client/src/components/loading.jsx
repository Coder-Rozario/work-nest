import logo from "../assets/logo.svg"

const Loading = () => {
  return (
    <div className="flex h-screen w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_#e0f2fe_0%,_#f8fafc_42%,_#eef2ff_100%)]">
      <div className="flex flex-col items-center justify-center gap-5">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-28 w-28 rounded-full border-4 border-blue-200/80 border-t-blue-600 border-r-cyan-500 animate-spin" />
          <div className="absolute h-20 w-20 rounded-full border-4 border-slate-200 border-b-green-500 border-l-blue-500 animate-pulse" />
          <img
            src={logo}
            alt="logo"
            className="relative h-16 w-16 rounded-2xl bg-white/80 p-2 shadow-lg shadow-blue-200/60 backdrop-blur-sm animate-[pulse_1.8s_ease-in-out_infinite]"
          />
        </div>

        <div className="text-center m-6">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-blue-600">WorkNest</p>
          <p className="mt-2 text-sm font-medium text-slate-600">Loading your workspace...</p>
        </div>
      </div>
    </div>
  )
}

export default Loading
