// English / 中文 toggle. The page is written in English; switching to Chinese swaps text from the tables below,
// including labels the demos and charts draw later, and the choice is remembered. The paper title, authors and
// affiliations stay in English.
(function(){
// Blocks whose word order changes in Chinese are swapped whole (keyed by their English innerHTML, whitespace collapsed).
const HTML={
'Learn <span>loco-manipulation</span><br>across <span>embodiments</span><br>from <span>human experience</span>.':'从<span>人类经验</span>中，<br>学习跨<span>本体</span>的<br><span>移动操作</span>。',
'Curate <span>Xp-Data</span>: 10k hours of human<br class="br-wide"> and 3k hours of robot data<br class="br-wide"> with multimodal annotations.':'构建 <span>Xp-Data</span>：<br class="br-wide">10k 小时人类数据与 3k 小时机器人数据，<br class="br-wide">并附多模态标注。',
'Unify loco-manipulation across embodiments<br>with <span>one kinematic interface</span>.':'以<span>统一的运动学接口</span>，<br>跨本体统一移动操作。',
'The more human experience,<br>the <span>better the world model</span>.':'人类经验越多，<br><span>世界模型越好</span>。',
'Predict <span>loco-manipulation</span> more faithfully,<br>across <span>embodiments</span> and data regimes.':'更忠实地预测<span>移动操作</span>，<br>跨越不同<span>本体</span>与数据规模。',
'Serve as a <span>world simulator</span>.<br>Evaluate, plan, teleoperate and learn.':'作为<span>世界模拟器</span>，<br>用于评估、规划、遥操作与学习。',
'Each clip is from ω-HOME: <b>zero-shot</b>, after <b>a few episodes</b>, and after <b>one epoch</b> on the target robot.':'每段均来自 ω-HOME，依次为：<b>零样本</b>、在目标机器人上用<b>少量回合</b>后训练、以及训练<b>一个 epoch</b> 后。',
'Held-out clip. Ropedia W0 saw this robot\'s data in <b>mid-training</b>; Cosmos 3 was <b>fine-tuned</b> on it. Input skeleton drawn over each generated video; PSNR (dB) per clip.':'留出片段。Ropedia W0 在<b>中期训练</b>中见过该机器人的数据，Cosmos 3 则在其上<b>微调</b>。生成视频上叠加了输入骨架；标注为每段的 PSNR (dB)。',
};
const TEXT={
'Video quality':'视频画质','Video quality for this section':'本区域视频画质','Compressed':'压缩版','Original':'原始版',
'Tasks 1–4':'任务 1–4','Tasks 5–8':'任务 5–8','Task group':'任务组',
'Four tasks; scroll horizontally to see more':'四个任务，可横向滑动查看更多','Rollout time, shown tasks':'当前任务组的播放进度',
'Loading video…':'视频加载中…','Video could not load. Press play to retry.':'视频加载失败，请点击播放重试。',
'Retry video':'重试播放',
'Video could not load. Choose a task to retry.':'视频加载失败，请重新选择任务重试。',
// header, contents, cover
'Skip to content':'跳到正文','Contents':'目录','Overview':'概览','Curate Xp-Data':'构建 Xp-Data',
'Unify loco-manipulation across embodiments':'跨本体统一移动操作','Scale up human experience':'扩展人类经验',
'Predict loco-manipulation more faithfully':'更忠实地预测移动操作','Lead across benchmarks':'全面领先各基准',
'Compare with state-of-the-art world models':'与最先进的世界模型对比','One model, many embodiments':'一个模型，多种本体',
'Predict over long horizons':'长时程预测','Serve as a world simulator':'作为世界模拟器','Evaluate and plan in imagination':'在想象中评估与规划',
'Teleoperate live in VR':'在 VR 中实时遥操作','Learn better policies':'学习更好的策略','Cite Ropedia W0':'引用 Ropedia W0','Cite':'引用',
'Equal contribution':'同等贡献','Corresponding author':'通讯作者',
'Paper':'论文','Video':'视频','Code':'代码','Model':'模型','Dataset':'数据集',
'Watch with sound on for the full experience.':'建议开启声音观看。',
// 00 overview
'is the first egocentric loco-manipulation world foundation model spanning humans and robots with diverse embodiments. It encodes locomotion as camera poses and manipulation as projected skeletons, one kinematic interface shared by humans and robots.':'是首个覆盖人类与多种机器人本体的第一人称移动操作世界基础模型。它以相机位姿表示移动、以投影骨架表示操作，人与机器人共用同一套运动学接口。',
'Data':'数据','Learn from 13k hours of experience':'从 13k 小时经验中学习','Unify embodiments with one interface':'用一个接口统一各本体',
'Scaling':'扩展规律','Scale with human experience':'随人类经验扩展','Performance':'性能','Predict more faithfully':'预测更忠实','Applications':'应用',
// 01 data
'Public egocentric datasets are limited in scale and uneven in quality: many lack metric camera trajectories, have noisy or missing hand poses, or use incompatible formats.':'公开的第一人称数据集规模有限、质量参差：许多缺少度量尺度的相机轨迹，手部姿态噪声大或缺失，格式也互不兼容。',
'puts every clip in one schema, with synchronised egocentric RGB, camera trajectory, manipulator skeleton and caption.':'将每个片段统一为同一格式，并同步提供第一人称 RGB、相机轨迹、操作体骨架与文本描述。',
'Annotation':'标注','Label with humans in the loop':'人在回路的标注','Automated models annotate each clip; targeted human checks ensure quality.':'由自动模型标注每个片段，再辅以有针对性的人工核查以保证质量。',
'Public data':'公开数据','Re-annotate public data':'重新标注公开数据','14 human and 13 robot datasets, unified in one schema.':'14 个人类数据集与 13 个机器人数据集，统一为同一格式。',
'Our recordings':'自采数据','Record our own':'自主采集','6,000+ hours of multi-view egocentric video from a four‑fisheye rig.':'6,000+ 小时多视角第一人称视频，由四鱼眼相机设备采集。',
'Benchmark':'基准','Build Xp-Teleop':'构建 Xp-Teleop','Whole-body dexterous humanoid teleoperation in six household activity groups, for long-horizon evaluation.':'覆盖六类家务活动的全身灵巧人形遥操作数据，用于长时程评测。',
'Human & robot data':'人类与机器人数据','Multimodal annotations':'多模态标注','Auto-loop':'自动轮播',
'human video':'人类视频','robot data':'机器人数据','whole-body teleoperation':'全身遥操作',
'Human and robot experience in Xp-Data.':'Xp-Data 中的人类与机器人经验。',
'Multimodal annotations. Human clip: point cloud, camera trajectory, 2D hand keypoints and dense captions. Robot clip: 2D keypoints, wide-FOV skeleton, camera trajectory, wrist pose and captions.':'多模态标注。人类片段：点云、相机轨迹、2D 手部关键点与密集描述；机器人片段：2D 关键点、广视场骨架、相机轨迹、腕部位姿与描述。',
'Xp-Teleop: whole-body teleoperation on a Unitree G1 with two dexterous hands, spanning six household activity groups (about one hour), used as a long-horizon benchmark. Every take is recorded with synchronised RGB-D, camera pose, skeletons, robot state, tactile, head IMU and language.':'Xp-Teleop：在配备两只灵巧手的 Unitree G1 上进行全身遥操作，覆盖六类家务活动（约一小时），用作长时程基准。每段录制同步记录 RGB-D、相机位姿、骨架、机器人状态、触觉、头部 IMU 与语言。',
// 02 model
'Ropedia W0 is a latent video diffusion model that generates future egocentric video from the first frame, a text prompt and actions (two kinematic signals). Action signals are explicit and pixel-aligned with the video, so they are easy to learn, and since any human or robot body can be rendered in the same format, they transfer across embodiments.':'Ropedia W0 是一个潜空间视频扩散模型，根据首帧、文本提示与动作（两种运动学信号）生成未来的第一人称视频。动作信号显式且与视频像素对齐，因而易于学习；任何人类或机器人身体都能以同一格式渲染，因此可跨本体迁移。',
'Locomotion':'移动','Camera poses':'相机位姿','Relative to the first frame, as dense Plücker-ray maps; every step and turn moves the view.':'以首帧为参考，编码为稠密 Plücker 射线图；每一步、每次转身都会改变视角。',
'Manipulation':'操作','Projected skeletons':'投影骨架','Hand keypoints projected into each frame, from pose annotations for humans and forward kinematics for robots.':'将手部关键点逐帧投影到图像中：人类来自姿态标注，机器人来自正向运动学。',
'Scale':'规模','Two model scales':'两种模型规模','A dense 5B model and A14B, a mixture-of-experts with 14B active parameters.':'稠密的 5B 模型，以及激活参数为 14B 的混合专家模型 A14B。',
'Training':'训练','From humans to robots':'从人类到机器人','Human pre-training, then human–robot mid-training; optional post-training on a target robot.':'先进行人类预训练，再进行人类–机器人中期训练；可选地在目标机器人上后训练。',
'Cross-embodiment kinematics feed camera and skeleton maps into a diffusion transformer that generates the future video.':'跨本体运动学生成相机图与骨架图，输入扩散 Transformer，生成未来视频。',
// 03 scaling
'With the post-training recipe fixed, we vary how much human video goes into pre-training, up to about 10k hours.':'固定后训练方案，改变预训练所用人类视频的规模，最多约 10k 小时。',
'Human':'人类','Better human prediction':'人类预测更准','Camera and hand following improve steadily as human pre-training grows.':'随着人类预训练数据增加，相机与手部跟随持续提升。',
'Robot':'机器人','Better robot prediction':'机器人预测更准','The gains carry over to robot prediction across embodiments.':'这一提升同样迁移到各本体的机器人预测上。',
'Human video':'人类视频','evaluated on held-out human clips':'在留出的人类片段上评估','evaluated on robot benchmarks':'在机器人基准上评估',
'Camera following':'相机跟随','Hand following':'手部跟随','pre-training human hours (log scale)':'预训练人类视频时长（对数坐标）','human hours (log)':'人类视频时长（对数）','GR-1 in-lab':'GR-1 实验室',
// 04 performance
'Benchmarks':'基准','State of the art on human video and every robot benchmark, from zero-shot to full-data post-training.':'在人类视频与所有机器人基准上均达到最优，覆盖零样本到全量数据后训练。',
'Baselines':'基线','Outperform Cosmos 3':'超越 Cosmos 3','Matches the ground truth more closely than both Cosmos 3 models, including the larger':'比两个 Cosmos 3 模型都更接近真值，包括规模更大的',
'Embodiments':'本体','Cover many embodiments':'覆盖多种本体','Humans, gripper arms and dexterous humanoids, steady as the body walks and turns.':'覆盖人类、夹爪机械臂与灵巧人形，身体行走转身时依然稳定。',
'Long horizon':'长时程','Lead on long rollouts':'长时程推演领先','Stays ahead of the baselines over long rollouts that chain locomotion and manipulation.':'在串联移动与操作的长时程推演中持续领先基线。',
'Quantitatively, Ropedia W0 leads on held-out human video and five robot benchmarks (DreamDojo, Ψ0, ω-HOME, AgiBot and our Xp-Teleop), from zero-shot to full-data post-training; on DreamDojo\'s own protocol, it leads at every data budget.':'定量结果：在留出的人类视频与五个机器人基准（DreamDojo、Ψ0、ω-HOME、AgiBot 及我们的 Xp-Teleop）上，从零样本到全量数据后训练，Ropedia W0 均领先；在 DreamDojo 自身的评测协议下，各数据量设置也都领先。',
'DreamDojo benchmark':'DreamDojo 基准','All benchmarks':'全部基准','DreamDojo benchmark · GR-1 post-training':'DreamDojo 基准 · GR-1 后训练','In-lab':'实验室',
'Swipe to see all benchmarks →':'左右滑动查看全部基准 →','DreamDojo benchmark.':'DreamDojo 基准。',
'PSNR on its three test sets after post-training on 1%, 10% or 100% of its GR-1 data.':'在其 GR-1 数据的 1%、10% 或 100% 上后训练后，三个测试集上的 PSNR。',
'All benchmarks · zero-shot to full data':'全部基准 · 零样本到全量数据','Human video and four robot benchmarks; further out is better':'人类视频与四个机器人基准；越靠外越好',
'Ropedia W0 (A14B) is the outermost line on every axis.':'Ropedia W0 (A14B) 在每个轴上都位于最外侧。','All benchmarks.':'全部基准。',
'Each axis is one benchmark and setting, from zero-shot to full-data post-training.':'每个轴对应一个基准及其设置，覆盖零样本到全量数据后训练。',
'Qualitatively, given the same input frame and actions, Ropedia W0 stays closer to the ground truth than Cosmos 3.':'定性结果：给定相同的输入帧与动作，Ropedia W0 比 Cosmos 3 更接近真值。',
'Ground truth':'真值','Zero-shot':'零样本',
'on ω-HOME, which no model was trained on. Input skeleton drawn over each generated video; PSNR (dB) per clip.':'：在 ω-HOME 上评测，所有模型均未在其上训练。生成视频上叠加了输入骨架；标注为每段的 PSNR (dB)。',
'A shared kinematic action space lets one model predict humans, gripper robots and dexterous humanoids, with consistent scenes under locomotion.':'共享的运动学动作空间让一个模型即可预测人类、夹爪机器人与灵巧人形，并在移动中保持场景一致。',
'Twenty datasets':'二十个数据集','On the move':'移动中','Adapting to a new robot':'适应新机器人',
'Twenty datasets, from people to humanoids, each generated from one frame and the body\'s actions. Hover or tap to read the task.':'二十个数据集，从人类到人形机器人，均由一帧图像与身体动作生成。悬停或点按可查看任务。',
'Generated clips with large camera motion.':'大幅相机运动下的生成片段。','Show selected datasets −':'收起 −',
'Ropedia W0 · zero-shot':'Ropedia W0 · 零样本','Ropedia W0 · few-shot':'Ropedia W0 · 少样本','Ropedia W0 · 1-epoch':'Ropedia W0 · 1 个 epoch',
'Long autoregressive rollouts chain locomotion and manipulation, each generated from a single real frame and the commanded actions.':'长时程自回归推演串联移动与操作，每段都由单帧真实图像与指令动作生成。',
'Eight tasks':'八个任务','Drag the hand':'拖动手部','Action · drag the hand':'动作 · 拖动手部','drag me':'拖我','Output · Ropedia W0':'输出 · Ropedia W0',
'Drag the hand along its commanded path, or drag the timeline, to step through the rollout; the right panel shows the frame Ropedia W0 generated at that moment, with its conditions in the corners.':'沿指令路径拖动手部或拖动时间轴，逐步查看推演；右侧为 Ropedia W0 在该时刻生成的画面，两角显示对应的条件。',
// task names (comparisons, adaptation, long horizon, dataset wall, real robot)
'Arrange the fruit bucket':'整理水果桶','Collect toys from the bed':'收拾床上的玩具','Take from the upper fridge':'从冰箱上层取物','Push the chair':'推椅子',
'Push the chair with both hands':'双手推椅子','Put the apple in the fruit basket':'把苹果放进果篮','Sort fruit from office supplies':'从办公用品中分拣水果','Brush the toilet':'刷马桶',
'Highlights · 30 s':'精华版 · 30 秒','Full video · 2 min':'完整版 · 2 分钟','Choose a video':'选择视频','Ropedia W0 highlights':'Ropedia W0 精华版','Put the tape in the bag':'把胶带放进袋子','Put the pear on the lower shelf':'把梨放到架子下层','Grab the desk fan':'拿起台式风扇','Put the hot dog in the bowl':'把热狗放进碗里',
'Line up the fruit':'把水果排成一排','Turn the steering wheel':'转动方向盘','Close the door':'关门','Push the cart':'推手推车',
'Wipe the table':'擦桌子','Put the towel in the washing machine':'把毛巾放进洗衣机',
'Put a drink in the fridge':'把饮料放进冰箱','Collect the garbage':'收拾垃圾','Sweep the bed':'清扫床面','Collect fruit from the closet':'从柜子里取水果','Pick up the bok choy':'拿起小白菜',
'Scan a person\'s leg with a metal detector':'用金属探测器扫描人的腿部','Hang clothes on the rack':'把衣服挂到衣架上','Put a bottle in the green container':'把瓶子放进绿色容器',
'Move potatoes into a white basket':'把土豆移到白色篮子里','Stack five blocks in a vertical line':'把五块积木竖直叠起','Fully open the drawer':'把抽屉完全拉开',
'Drop paper into the trash bin':'把纸扔进垃圾桶','Coil string around a screwdriver':'把绳子绕在螺丝刀上','Walk up to the bed and reach for the duvet':'走到床边去够被子',
'Press a key on the keyboard':'按下键盘上的一个键','Plug the power brick into the strip':'把电源适配器插到插线板上','Place an egg on the plate':'把鸡蛋放到盘子上',
'Put a pink cube in the bin':'把粉色方块放进盒子','Place a pear on the plate':'把梨放到盘子上','Fold up the shirt':'叠好衬衫','Box the toys and carry them to the chair':'把玩具装箱并搬到椅子旁',
'Put a star fruit on the lower shelf':'把杨桃放到下层架子上','Replace a bedside lamp bulb':'更换床头灯灯泡','Fold a paper towel':'折叠纸巾','Put an apple in the basket':'把苹果放进篮子',
'AgiBot head camera':'AgiBot 头部相机','Human · EgoDemo':'人类 · EgoDemo','Human · OpenAOE':'人类 · OpenAOE',
'HIW-500 robot':'HIW-500 机器人','UnifoLM robot':'UnifoLM 机器人','Unitree G1 robot':'Unitree G1 机器人',
'Teddy into basket':'泰迪熊放进篮子','Orange onto tray':'橙子放到托盘上','Snack into basket':'零食放进篮子','Octopus into basket':'章鱼玩偶放进篮子',
'Cloth into basket':'衣物放进篮子','Cloth into bag':'衣物装进袋子','Robot view':'机器人视角',
// 05 applications
'Rollouts imagined by Ropedia W0 stand in for costly real-world trials, as validated in simulation and on physical robots.':'Ropedia W0 想象出的推演可替代代价高昂的真实试验，并已在仿真与真机上得到验证。',
'Policy evaluation':'策略评估','Correlation between imagined and real task progress; the checkpoint ranking is preserved.':'想象与真实任务进度之间的相关系数；检查点排序保持一致。',
'Planning':'规划','Over the best single checkpoint, in simulation / on a real robot, by planning in imagination.':'在想象中规划，相对最佳单一检查点的提升（仿真 / 真机）。',
'Real-time teleoperation':'实时遥操作','640×480 video streamed on one GPU by a 4-step distilled model, for live VR control.':'4 步蒸馏模型在单卡上流式生成 640×480 视频，支持实时 VR 操控。',
'World–action models':'世界–动作模型','Real Unitree G1 task progress: FastWAM vs. FastWAM initialised from Ropedia W0.':'真实 Unitree G1 上的任务进度：FastWAM 与以 Ropedia W0 初始化的 FastWAM 对比。',
'As a proxy environment, Ropedia W0 ranks policy checkpoints in the same order as real runs (MMRV = 0). For planning, it imagines candidate action sequences, a value model scores them, and the best one is executed.':'作为代理环境，Ropedia W0 对策略检查点的排序与真实运行一致（MMRV = 0）。规划时，模型想象候选动作序列，由价值模型打分，执行得分最高者。',
'Task progress (%), predicted vs. real; ranking preserved':'任务进度（%），预测 vs. 真实；排序一致','predicted':'预测','real':'真实','Teleop (reference)':'遥操作（参考）',
'Task progress (%): checkpoints, random pick, planned pick':'任务进度（%）：各检查点、随机选择、规划选择','Rand':'随机','Plan':'规划','checkpoint':'检查点',
'Policy evaluation: predicted vs. real progress for each checkpoint (dashed line = perfect agreement); on G1 the hollow point is a teleoperation reference, not a checkpoint. Planning: the planned pick beats every single checkpoint.':'策略评估：每个检查点的预测与真实进度（虚线表示完全一致；G1 上的空心点为遥操作参考，并非检查点）。规划：规划选择优于每一个单独的检查点。',
'Distilled into a 4-step autoregressive model, Ropedia W0 streams 640×480 video at 21.3 fps on one GPU and stays stable for minutes. An operator in a Quest 3 headset moves, and the model renders what a human or robot body would see.':'蒸馏为 4 步自回归模型后，Ropedia W0 在单卡上以 21.3 fps 流式生成 640×480 视频，并可稳定运行数分钟。操作者戴着 Quest 3 头显移动，模型即渲染人类或机器人身体所见的画面。',
'The operator\'s head and hands drive the model; the generated view is on the screen. Six sessions at 1×.':'操作者的头部与双手驱动模型，屏幕上为生成画面。共六段，均为 1 倍速。',
'Initialising the video backbone of a world–action model (FastWAM) from Ropedia W0 5B, with everything else unchanged, raises held-out LIBERO-Plus success from 50.1% to 56.8% and helps every few-shot setting. On a real Unitree G1 the resulting policy reaches 56.7% task progress, against 33.3% for FastWAM; its executions are shown below.':'用 Ropedia W0 5B 初始化世界–动作模型（FastWAM）的视频主干、其余保持不变，LIBERO-Plus 留出任务成功率从 50.1% 提升到 56.8%，各少样本设置也都有提升。在真实 Unitree G1 上，所得策略的任务进度达到 56.7%，FastWAM 为 33.3%；执行过程见下方。',
'The external view and the robot\'s own view, in sync at 1×.':'外部视角与机器人自身视角同步播放，1 倍速。',
'Reference':'参考','.':'。','Citation':'引用','Coming soon':'即将发布','Back to top ↑':'返回顶部 ↑',
// controls and accessible names
'Background':'背景','White background':'白色背景','Black background':'黑色背景','Language':'语言','Sections':'章节','Paper resources':'论文资源',
'Read the paper':'阅读论文','Watch the video on YouTube':'在 YouTube 观看视频','View code on GitHub':'在 GitHub 查看代码',
'View model weights on Hugging Face':'在 Hugging Face 查看模型权重','Copy BibTeX':'复制 BibTeX',
'Scroll to the video':'滚动到视频','Research video':'研究视频','Ropedia W0 video':'Ropedia W0 视频','Seek the video':'拖动视频进度',
'Play':'播放','Pause':'暂停','Enter full screen':'全屏','Exit full screen':'退出全屏','Unmute':'取消静音','Mute':'静音','Video time':'视频时间',
'Data videos':'数据视频','View':'视图','Data budget':'数据量','Task':'任务','Embodiment':'本体','Session':'片段',
'Wall of egocentric human video zooming out':'第一人称人类视频墙（逐渐拉远）','Wall of robot video zooming out':'机器人视频墙（逐渐拉远）',
'Annotation viewer for a human clip':'人类片段的标注查看器','Annotation viewer for a robot clip':'机器人片段的标注查看器',
'Wall of Xp-Teleop humanoid teleoperation clips':'Xp-Teleop 人形遥操作片段墙','All recorded modalities of an Xp-Teleop take':'一段 Xp-Teleop 录制的全部模态',
'Architecture: cross-embodiment kinematics, loco-manipulation conditioning, unified world modelling with a DiT':'架构：跨本体运动学、移动操作条件、基于 DiT 的统一世界建模',
'Camera ATE falls from 2.21 to 1.79 cm':'相机 ATE 从 2.21 降至 1.79 cm','Hand PCK@0.1 rises from 82.0% to 83.6%':'手部 PCK@0.1 从 82.0% 升至 83.6%',
'GR-1 PSNR rises from 19.81 to 21.74 dB':'GR-1 PSNR 从 19.81 升至 21.74 dB','G1 LPIPS falls from 0.427 to 0.365':'G1 LPIPS 从 0.427 降至 0.365',
'PSNR comparison chart, scroll horizontally on small screens':'PSNR 对比图，小屏幕上可横向滚动','PSNR bars per benchmark':'各基准的 PSNR 柱状图',
'Radar chart: Ropedia W0 encloses all baselines across benchmarks and data budgets':'雷达图：在各基准与数据量下，Ropedia W0 均包围所有基线',
'Ground truth, Ropedia W0 and two Cosmos 3 baselines side by side':'真值、Ropedia W0 与两个 Cosmos 3 基线并排对比',
'Ground truth and Ropedia W0 after zero-shot, few-shot and one-epoch post-training, side by side':'真值与 Ropedia W0 在零样本、少样本、一个 epoch 后训练下的并排对比',
'Rollout time, all eight tasks':'推演时间（八个任务）','Rollout time':'推演时间',
'Action: commanded wrist path over the input frame, with camera and hand-pose conditions; drag the hand':'动作：输入帧上的指令腕部路径及相机、手部姿态条件；可拖动手部',
'Frame generated by Ropedia W0 at this point of the rollout':'Ropedia W0 在推演该时刻生成的画面','Camera-trajectory condition at this moment':'该时刻的相机轨迹条件','Hand-pose condition at this moment':'该时刻的手部姿态条件',
'r = 0.984 in simulation, 0.996 on the real robot':'仿真中 r = 0.984，真机上 r = 0.996','92% vs 53% in simulation, 55% vs 26% on the real robot':'仿真 92% vs 53%，真机 55% vs 26%',
'External view':'外部视角','Authors':'作者','Affiliations':'单位',
};
// Labels the scripts compose at run time.
const RX=[
 ['^\\+([\\d.]+) dB vs best DreamDojo$','比最好的 DreamDojo 高 $1 dB'],
 ['^(.+) · \\+(\\d+) pp over best$','$1 · 较最佳 +$2 pp'],
 ['^(.+) · External$','§T$1§ · 外部视角'],
 ['^Session (\\d+)$','第 $1 段'],
 ['^Live VR session: robot view (\\d+)$','实时 VR 片段：机器人视角 $1'],
 ['^Live VR session: human view (\\d+)$','实时 VR 片段：人类视角 $1'],
 ['^View all (\\d+) datasets \\+$','查看全部 $1 个数据集 +'],
].map(([p,t])=>[new RegExp(p),t]);

const SWAP='h2,h3,p,li,figcaption,.ct,.cs';
const ATTRS=['aria-label','title','data-short','data-label','alt'];
const SKIP='script,style,pre,h1,.au,.af,[data-en]';
const norm=s=>s.trim().replace(/\s+/g,' ');
const texts=new Map(),attrs=new Map();
let lang='en',observer=null;
const tr=s=>{const k=norm(s);if(!k)return null;let out=TEXT[k];
  if(out==null)for(const [re,t] of RX)if(re.test(k)){out=k.replace(re,t).replace(/§T(.+?)§/,(m,x)=>TEXT[x]||x);break}
  if(out==null)return null;const r=s.replace(s.trim(),out);
  return /^[：，。；、）]/.test(out)?r.replace(/^\s+/,''):r};   // Chinese punctuation attaches to the word before it
const skip=n=>n.parentElement&&n.parentElement.closest(SKIP);
function swapBlock(el){if(el.closest('script,style,h1,.au,.af')||el.dataset.en!=null)return;const en=norm(el.innerHTML),zh=HTML[en];if(zh){el.dataset.en=el.innerHTML;el.innerHTML=zh}}
function textNode(n){if(skip(n))return;const t=tr(n.data);if(t!=null&&t!==n.data){texts.set(n,n.data);n.data=t}}
function attr(el,a){const v=el.getAttribute(a);if(v==null)return;const t=tr(v);if(t!=null&&t!==v){const m=attrs.get(el)||{};if(!(a in m))m[a]=v;attrs.set(el,m);el.setAttribute(a,t)}}
function within(root){
  if(root.nodeType===3){textNode(root);return}
  if(root.nodeType!==1)return;
  if(root.matches(SWAP))swapBlock(root);root.querySelectorAll(SWAP).forEach(swapBlock);
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode()))textNode(n);
  for(const a of ATTRS){if(root.hasAttribute(a))attr(root,a);root.querySelectorAll('['+a+']').forEach(el=>attr(el,a))}
}
function toZh(){
  within(document.body);
  observer=new MutationObserver(ms=>{for(const m of ms){
    if(m.type==='characterData')textNode(m.target);
    else if(m.type==='attributes')attr(m.target,m.attributeName);
    else{const t=m.target;if(t.nodeType===1&&t.matches(SWAP)&&t.dataset.en!=null&&norm(t.innerHTML)!==norm(HTML[norm(t.dataset.en)]||'')){delete t.dataset.en;swapBlock(t)}
      m.addedNodes.forEach(n=>{if(n.nodeType===1&&n.parentElement&&n.parentElement.matches(SWAP))swapBlock(n.parentElement);within(n)})}}});
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
}
function toEn(){
  if(observer){observer.disconnect();observer=null}
  document.querySelectorAll('[data-en]').forEach(el=>{el.innerHTML=el.dataset.en;delete el.dataset.en});
  texts.forEach((v,n)=>{n.data=v});texts.clear();
  attrs.forEach((m,el)=>{for(const a in m)el.setAttribute(a,m[a])});attrs.clear();
}
const btns=[...document.querySelectorAll('.lang-switch button')];
function set(l,save){
  if(l===lang)return;lang=l;
  if(l==='zh')toZh();else toEn();
  document.documentElement.lang=l==='zh'?'zh-CN':'en';
  btns.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===l)));
  if(save)try{localStorage.setItem('xp0-lang',l)}catch(e){}
  if(typeof drawCharts==='function')drawCharts();   // chart labels are redrawn, then translated by the observer
}
btns.forEach(b=>b.addEventListener('click',()=>set(b.dataset.lang,true)));
let saved=null;try{saved=localStorage.getItem('xp0-lang')}catch(e){}
if(saved==='zh')set('zh',false);
})();
